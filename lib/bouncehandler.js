var bounce_responses = require('./responses');
var mimelib = require('mimelib');
 
/* BOUNCE HANDLER Class, Version 7.3
 * Description: "chops up the bounce into associative arrays"
 *     ~ http://www.anti-spam-man.com/php_bouncehandler/v7.3/
 *     ~ https://github.com/cfortune/PHP-Bounce-Handler/
 *     ~ http://www.phpclasses.org/browse/file/11665.html
 */
 
/* Debugging / Contributers:
    * "Kanon"
    * Jamie McClelland http://mayfirst.org
    * Michael Cooper
    * Thomas Seifert
    * Tim Petrowsky http://neuecouch.de
    * Willy T. Koch http://apeland.no
    * ganeshaspeaks.com - FBL development
    * Richard Catto - FBL development
    * Scott Brynen - FBL development  http://visioncritical.com
*/
 
 
/*
 The BSD License
 Copyright (c) 2006-forever, Chris Fortune http://cfortune.kics.bc.ca
 All rights reserved.
 
Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 
    * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
    * Neither the name of the BounceHandler nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
var BounceHandler = function() {
     
    /**** VARS ****************************************************************/
    this.head_hash = [];
    this.fbl_hash = [];
    this.body_hash = []; // not necessary
    this.bouncelist = []; // from bounce_responses.txt
    this.autorespondlist = []; // from bounce_responses.txt
 
    this.looks_like_a_bounce = false;
    this.looks_like_an_FBL = false;
    this.looks_like_an_autoresponse = false;
    this.is_hotmail_fbl = false;
     
    // these are for feedback reports, so you can extract uids from the emails
    // eg X-my-custom-header: userId12345
    // eg <img src="http://mysite.com/track.php?u=userId12345">
    this.web_beacon_preg_1 = "";
    this.web_beacon_preg_2 = "";
    this.x_header_search_1 = "";
    this.x_header_search_2 = "";
 
    // accessors
    this.type = "";
    this.web_beacon_1 = "";
    this.web_beacon_2 = "";
    this.feedback_type = "";
	this.feedback_useragent= "";
    this.x_header_beacon_1 = "";
    this.x_header_beacon_2 = "";
     
    // these accessors are useful only for FBL's
    // or if the output array has only one index
    this.action = "";
    this.status = "";
    this.subject = "";
    this.recipient = "";
 
    // the raw data set, a multiArray
    this.output = [];
     
    /**** INSTANTIATION *******************************************************/
    this.output.push({
		'action': "",
		'status': "",
		'recipient': "",
		'messageid': ""
	});
	
    this.bouncelist = bounce_responses.bouncelist;
    this.autorespondlist = bounce_responses.autorespondlist;
 
    /**** METHODS *************************************************************/
    // this is the most commonly used public method
    // quick and dirty
    // useage: multiArray = this.get_the_facts(strEmail);
    this.parse_email = function(eml){
        return this.get_the_facts(eml);
    }
    this.get_the_facts = function(eml){
        // fluff up the email
        var bounce = this.init_bouncehandler(eml);
        var head_body = bounce.split(/\r\n\r\n/);
		var head = head_body.shift();
		var body = head_body.join("\r\n\r\n");
		
        this.head_hash = this.parse_head(head);
		// Fix head_hash mandatory header
		if (this.head_hash) {
			if (!this.head_hash['Subject']) { this.head_hash['Subject'] = '(no-subject)'; }
		}

        // parse the email into data structures
        var boundary = this.head_hash['Content-type']? this.head_hash['Content-type']['boundary'] : undefined;
        var mime_sections = this.parse_body_into_mime_sections(body, boundary);
        this.body_hash = body.split(/\r\n/);
        this.first_body_hash = this.parse_head(mime_sections['first_body_part']);

        this.looks_like_a_bounce = this.is_a_bounce();
        this.looks_like_an_FBL = this.is_an_ARF();
        this.looks_like_an_autoresponse = this.is_an_autoresponse();

        /* If you are trying to save processing power, and don't care much
         * about accuracy then uncomment this statement in order to skip the
         * heroic text parsing below. 
         */
        //if(!this.looks_like_a_bounce && !this.looks_like_an_FBL && !this.looks_like_an_autoresponse){
        //    return "unknown";
        //}
 
        /*** now we try all our weird text parsing methods (E-mail is weird!) ******************************/
		if (!this.output.length) {
			this.output.push({
				'status': '',
				'action': '',
				'recipient': '',
				'messageid': ''
			});
		}
		
        // is it a Feedback Loop, in Abuse Feedback Reporting Format (ARF)?
        // http://en.wikipedia.org/wiki/Abuse_Reporting_Format#Abuse_Feedback_Reporting_Format_.28ARF.29
        if(this.looks_like_an_FBL){
            this.output[0]['action'] = 'failed';
            this.output[0]['status'] = "5.7.1";
            this.subject = this.head_hash['Subject'].replace(/Fw:/gi,"").trim();
            if(this.is_hotmail_fbl === true){
                // fill in the fbl_hash with sensible values
                this.fbl_hash['Content-disposition'] = 'inline';
                this.fbl_hash['Content-type'] = 'message/feedback-report';
                this.fbl_hash['Feedback-type'] = 'abuse';
                this.fbl_hash['User-agent'] = 'Hotmail FBL';
                if (typeof this.first_body_hash['Date'] != 'undefined') {
                    this.fbl_hash['Received-date'] = this.first_body_hash['Date'];
                }
                if (this.recipient){
                    this.fbl_hash['Original-rcpt-to'] = this.recipient;
                }
                if(typeof this.first_body_hash['X-sid-pra'] != 'undefined'){
                    this.fbl_hash['Original-mail-from'] = this.first_body_hash['X-sid-pra'];
                }
            }
            else{
	
                this.fbl_hash = this.standard_parser(mime_sections['machine_parsable_body_part']);
                var returnedhash = this.standard_parser(mime_sections['returned_message_body_part']);
                if (!this.fbl_hash['Original-mail-from'] && returnedhash['From']) {
                    this.fbl_hash['Original-mail-from'] = returnedhash['From'];
                }
                if (!this.fbl_hash['Original-rcpt-to'] && this.fbl_hash['Removal-recipient'] ) {
                    this.fbl_hash['Original-rcpt-to'] = this.fbl_hash['Removal-recipient'];
                }
                else if (returnedhash['To']) {
                    this.fbl_hash['Original-rcpt-to'] = returnedhash['To'];
                }

				if(!this.fbl_hash['Original-mail-messageid'] && returnedhash['Message-id']) {
					this.fbl_hash['Original-mail-messageid'] = returnedhash['Message-id'];
				}

            }
            // warning, some servers will remove the name of the original intended recipient from the FBL report,
            // replacing it with redactedrcpt-hostname.com, making it utterly useless, of course (unless you used a web-beacon).
            // here we try our best to give you the actual intended recipient, if possible.
            if (this.fbl_hash['Original-rcpt-to'].match(/Undisclosed|redacted/i) && typeof this.fbl_hash['Removal-recipient'] != 'undefined' ) {
                this.fbl_hash['Original-rcpt-to'] = this.fbl_hash['Removal-recipient'];
            }
            if (!this.fbl_hash['Received-date'] && this.fbl_hash['Arrival-date'] ) {
                this.fbl_hash['Received-date'] = this.fbl_hash['Arrival-date'];
            }
            this.fbl_hash['Original-mail-from'] = this.strip_angle_brackets(this.fbl_hash['Original-mail-from']);
            this.fbl_hash['Original-rcpt-to']   = this.strip_angle_brackets(this.fbl_hash['Original-rcpt-to']);
            this.output[0]['recipient'] = this.fbl_hash['Original-rcpt-to'];
			this.output[0]['messageid'] = this.fbl_hash['Original-mail-messageid'] ? this.fbl_hash['Original-mail-messageid'] : null;
        }
 
        else if(this.head_hash['Subject'].match(/auto.{0,20}reply|vacation|(out|away|on holiday).*office/i)){
            // looks like a vacation autoreply, ignoring
            this.output[0]['action'] = 'autoreply';
        } 
 
        // is this an autoresponse ?
        else if (this.looks_like_an_autoresponse) {
            this.output[0]['action'] = 'transient';
            this.output[0]['status'] = '4.3.2';
            // grab the first recipient and break
            this.output[0]['recipient'] = typeof (this.head_hash['Return-path'])!='undefined' ? this.strip_angle_brackets(this.head_hash['Return-path']) : '';
            if(this.output[0]['recipient']){
                var arrFailed = this.find_email_addresses(body);
                for(j=0; j<arrFailed.length; j++){
                    this.output[j]['recipient'] = arrFailed[j].trim();
                    break; 
                }
            }
        }
 
        else if (this.is_RFC1892_multipart_report() === true){
            var rpt_hash = this.parse_machine_parsable_body_part(mime_sections['machine_parsable_body_part']);
            var rpt_head = this.get_head_from_returned_message_body_part(mime_sections);
            for(var i=0; i<rpt_hash['per_recipient'].length; i++){
				this.output[i] = {};
                this.output[i]['recipient'] = this.find_recipient(rpt_hash['per_recipient'][i]);
                var mycode = rpt_hash['per_recipient'][i]['Status']? this.format_status_code(rpt_hash['per_recipient'][i]['Status']) : '';
                this.output[i]['status'] = mycode['code']? mycode['code'].join('.') : '';
                this.output[i]['action'] = rpt_hash['per_recipient'][i]['Action']? rpt_hash['per_recipient'][i]['Action'] : '';
                // TODO: Review MessageId associated with each output.
                this.output[i]['messageid'] = rpt_head['MessageId']? rpt_head['MessageId'] : '';
            }
        }
 
        else if(typeof(this.head_hash['X-failed-recipients']) !='undefined') {
            //  Busted Exim MTA
            //  Up to 50 email addresses can be listed on each header.
            //  There can be multiple X-Failed-Recipients: headers. - (not supported)
            var arrFailed = this.head_hash['X-failed-recipients'].split(/\,/);
            for(var j=0; j<arrFailed.length; j++){
				if (typeof this.output[j] == 'undefined') this.output[j] = {};
                this.output[j]['recipient'] = arrFailed[j].trim();
                this.output[j]['status'] = this.get_status_code_from_text(this.output[j]['recipient'],0);
                this.output[j]['action'] = this.get_action_from_status_code(this.output[j]['status']);
                this.output[j]['messageid'] = this.get_messageid_from_text(this.output[j]['recipient'],0);
            }
        }
 
        else if(typeof(boundary) != 'undefined' && boundary && this.looks_like_a_bounce){
            // oh god it could be anything, but at least it has mime parts, so let's try anyway
            var arrFailed = this.find_email_addresses(mime_sections['first_body_part']);
            for(var j=0; j<arrFailed.length; j++){
				if (typeof this.output[j] == 'undefined') this.output[j] = {};
                this.output[j]['recipient'] = arrFailed[j].trim();
                this.output[j]['status'] = this.get_status_code_from_text(this.output[j]['recipient'],0);
                this.output[j]['action'] = this.get_action_from_status_code(this.output[j]['status']);
                this.output[j]['messageid'] = this.get_messageid_from_text(this.output[j]['recipient'],0);
            }
        }
 
        else if(this.looks_like_a_bounce){
            // last ditch attempt
            // could possibly produce erroneous output, or be very resource consuming,
            // so be careful.  You should comment out this section if you are very concerned
            // about 100% accuracy or if you want very fast performance.
            // Leave it turned on if you know that all messages to be analyzed are bounces.
            var arrFailed = this.find_email_addresses(body);
            for(var j=0; j<arrFailed.length; j++){
				if (typeof this.output[j] == 'undefined') this.output[j] = {};
                this.output[j]['recipient'] = arrFailed[j].trim();
                this.output[j]['status'] = this.get_status_code_from_text(this.output[j]['recipient'],0);
                this.output[j]['action'] = this.get_action_from_status_code(this.output[j]['status']);
                this.output[j]['messageid'] = this.get_messageid_from_text(this.output[j]['recipient'],0);
            }
        }
        // else if()..... add a parser for your busted-ass MTA here

        // remove empty array indices
        tmp = [];
        for(var i = 0; i < this.output.length; ++i){
			var arr = this.output[i];
            if(!arr['recipient'] && !arr['status'] && !arr['action'] ){
                continue;
            }
            tmp.push(arr);
        }
		this.output = tmp;
		
        // accessors
        /*if it is an FBL, you could use the class variables to access the
        data (Unlike Multipart-reports, FBL's report only one bounce)
        */
        this.type = this.find_type();
        this.action = this.output.length ? this.output[0]['action'] : '';
        this.status = this.output.length ? this.output[0]['status'] : '';
        this.subject = (this.subject) ? this.subject : this.head_hash['Subject'];
        this.recipient = this.output.length ? this.output[0]['recipient'] : '';
        this.messageid = this.output.length ? this.output[0]['messageid'] : '';
        this.feedback_type = this.fbl_hash['Feedback-type'] ? this.fbl_hash['Feedback-type'] : "";
		this.feedback_useragent = this.fbl_hash['User-agent'] ? this.fbl_hash['User-agent']  : "";
		
        // sniff out any web beacons
        if(this.web_beacon_preg_1)
            this.web_beacon_1 = this.find_web_beacon(body, this.web_beacon_preg_1);
        if(this.web_beacon_preg_2)
            this.web_beacon_2 = this.find_web_beacon(body, this.web_beacon_preg_2);
        if(this.x_header_search_1)
            this.x_header_beacon_1 = this.find_x_header  (this.x_header_search_1);
        if(this.x_header_search_2)
            this.x_header_beacon_2 = this.find_x_header  (this.x_header_search_2);
 
        return this.output;
    }
     
 
 
    this.init_bouncehandler = function(blob, format){
		if (typeof format == 'undefined') format = 'string';
		
        this.head_hash = [];
        this.fbl_hash = [];
        this.body_hash = []; 
        this.looks_like_a_bounce = false;
        this.looks_like_an_FBL = false;
        this.is_hotmail_fbl = false;
        this.type = "";
        this.feedback_type = "";
        this.action = "";
        this.status = "";
        this.subject = "";
        this.recipient = "";
        this.output = [];
 
        // TODO: accept several formats (XML, string, array)
        // currently accepts only string
        //if(format=='xml_array'){
        //    strEmail = "";
        //    out = "";
        //    for(i=0; i<blob; i++){
        //        out = preg_replace("/<HEADER>/i", "", blob[i]);
        //        out = preg_replace("/</HEADER>/i", "", out);
        //        out = preg_replace("/<MESSAGE>/i", "", out);
        //        out = preg_replace("/</MESSAGE>/i", "", out);
        //        out = rtrim(out) . "\r\n";
        //        strEmail .= out;
        //    }
        //}
        //else if(format=='string'){
 
            strEmail = blob.replace(/\r\n/g, "\n");    // line returns 1
            strEmail = strEmail.replace(/\n/g, "\r\n");// line returns 2
            strEmail = strEmail.replace(/=\r\n/g, ""); // remove MIME line breaks
            strEmail = strEmail.replace(/=3D/g, "=");  // equals sign =
            strEmail = strEmail.replace(/=09/g, "  "); // tabs
 
        //}
        //else if(format=='array'){
        //    strEmail = "";
        //    for(i=0; i<blob; i++){
        //        strEmail .= rtrim(blob[i]) . "\r\n";
        //    }
        //}
 
        return strEmail;
    }

    // general purpose recursive heuristic function
    // to try to extract useful info from the bounces produced by busted MTAs
    this.get_messageid_from_text = function(recipient, index){
	    var messageid = '';
	    for(var i=index; i<this.body_hash.length; i++){
		    line = this.body_hash[i].trim();
		    if (line.length < 1) {
			    continue;
		    }
		    
		    if(line.toLowerCase().indexOf('Message-ID'.toLowerCase())==0){
                var splits = line.split(':');
                messageid = splits[1].trim();
                break;
            }

            /***** retry bounce email might not have Message-ID instead may have status line *****/
            if (!messageid) {
	            var matches = line.match(/message identifier[^:]+:(.*)/);
	            if (matches) {
	                messageid = matches[1].trim();
	            }	
            }

        }
        return messageid;
	},

    // general purpose recursive heuristic function
    // to try to extract useful info from the bounces produced by busted MTAs
    this.get_status_code_from_text = function(recipient, index){
        for(var i=index; i<this.body_hash.length; i++){
            line = this.body_hash[i].trim();

            /******** recurse into the email if you find the recipient ********/
            if(line.toLowerCase().indexOf(recipient.toLowerCase())!=-1 && index == 0){
                // the status code MIGHT be in the next few lines after the recipient line,
                // depending on the message from the foreign host... What a laugh riot!
                var status_code = this.get_status_code_from_text(recipient, i+1);
                if(status_code){
                    return status_code;
                }
            }

            /******** exit conditions ********/
            // if it's the end of the human readable part in this stupid bounce
            if(line.toLowerCase().indexOf('------ This is a copy of the message'.toLowerCase())!=-1){
                return '';
            }
            //if we see an email address other than our current recipient's,
            if(this.find_email_addresses(line).length>=1
               && line.toLowerCase().indexOf(recipient.toLowerCase())== -1
               && line.indexOf('FROM:<')== -1){ // Kanon added this line because Hotmail puts the e-mail address too soon and there actually is error message stuff after it.
                return '';
            }

            /******** pattern matching ********/
			if (line.length) { // a bit-optimized to ignore scanning over blank lines
				for (var bouncetext in this.bouncelist) {
				  var bouncecode = this.bouncelist[bouncetext];			
				  var matches = line.match(new RegExp(bouncetext, "ig"));
	              if (matches) {
	                return typeof (matches[1]) != 'undefined' ? matches[1] : bouncecode;
	              }
	            }
			}
            
 
            // rfc1893 return code
			var matches = line.match(/\W([245]\.[01234567]\.[012345678])\W/);
            if(matches){
                if(line.toLowerCase().indexOf('Message-ID'.toLowerCase())!=-1){
                    break;
                }
                mycode = matches[1].replace(/\./g, '');
                mycode = this.format_status_code(mycode);
                return mycode['code'].join('.');
            }

            // search for RFC821 return code
            // thanks to mark.tolmangmail.com
            // Maybe at some point it should have it's own place within the main parsing scheme (at line 88)
			matches = line.match(/\]?: ([45][01257][012345]) /);
			if (!matches) {
				matches = line.match(/^([45][01257][012345]) (?:.*?)(?:denied|inactive|deactivated|rejected|disabled|unknown|no such|not (?:our|activated|a valid))+/i);
			}
            if(matches)
            {
                mycode = matches[1];
                // map common codes to new rfc values
                if(mycode == '450' || mycode == '550' || mycode == '551' || mycode == '554'){
                    mycode = '511';
                } else if(mycode == '452' || mycode == '552'){
                    mycode = '422';
                } else if (mycode == '421'){
                    mycode = '432';
                }
                mycode = this.format_status_code(mycode);
                return mycode['code'].join('.');
            }
 
        }
        return '';
    }
 
    this.is_RFC1892_multipart_report = function(){
        return this.head_hash['Content-type'] 
		   &&  this.head_hash['Content-type']['type']=='multipart/report'
           &&  this.head_hash['Content-type']['report-type']=='delivery-status'
           &&  this.head_hash['Content-type']['boundary']!=='';
    }
 
    this.parse_head = function(headers){
        if(typeof headers == 'string') headers = headers.split("\r\n");

        var hash = this.standard_parser(headers);
        if(hash['Content-type']){//preg_match('/Multipart\/Report/i', hash['Content-type'])){
            var multipart_report = hash['Content-type'].split(';');
            hash['Content-type']={};
            hash['Content-type']['type'] = multipart_report[0].toLowerCase();
            for(var i=0; i < multipart_report.length; ++i){
				var mr = multipart_report[i];
				var matches = mr.match(/([^=.]*?)=(.*)/i);
                if(matches){
                // didn't work when the content-type boundary ID contained an equal sign,
                // that exists in bounces from many Exchange servers
                //if(preg_match('/([a-z]*)=(.*)?/i', mr, matches)){
                    hash['Content-type'][matches[1].trim().toLowerCase()]= matches[2].replace(/"/g,'');
                }
            }
        }
        return hash;
    }
 
    this.parse_body_into_mime_sections = function(body, boundary){
        if(!boundary) return [];
        if(typeof body == 'object' && typeof body.length != 'undefined') body = body.join("\r\n");
        body = body.split(boundary);
		var mime_sections = {};
        mime_sections['first_body_part']            = body[1];
        mime_sections['machine_parsable_body_part'] = body[2];
        mime_sections['returned_message_body_part'] = body[3];
        return mime_sections;
    }
 
 
    this.standard_parser = function(content){ // associative array orstr
        // receives email head as array of lines
        // simple parse (Entity: value\n)
        var hash = { 'Received': '' }
		if(typeof content == 'undefined') content = [];
        if(typeof content == 'string') content = content.split("\r\n");

        for(var i = 0; i < content.length; ++i){
			var line = content[i];
			var array = line.match(/^([^\s.]*):\s*(.*)\s*/);
            if(array){
                var entity = array[1].toLowerCase();
				entity = entity.charAt(0).toUpperCase() + entity.slice(1);
				
                if(!hash[entity]){
                    hash[entity] = array[2].trim();
                }
                else if(hash['Received']){
                    // grab extra Received headers :(
                    // pile it on with pipe delimiters,
                    // oh well, SMTP is broken in this way
                    if (entity && array[2] && array[2] != hash[entity]){
                        hash[entity] += "|" + array[2].trim();
                    }
                }
            }
            else if (line.match(/^\s+(.+)\s*/) && entity) {
                hash[entity] += ' ' + line;
            }
        }
        // special formatting
        hash['Received']= hash['Recieved'] ? hash['Recieved'].split('|') : '';
        //hash['Subject'] = iconv_mime_decode(hash['Subject'], 0, "ISO-8859-1"); // REVIEW <<<<

        return hash;
    }
 
    this.parse_machine_parsable_body_part = function(str){
        //Per-Message DSN fields
        var hash = this.parse_dsn_fields(str);
        hash['mime_header'] = this.standard_parser(hash['mime_header']);
        hash['per_message'] = this.standard_parser(hash['per_message']);
        if(hash['per_message']['X-postfix-sender']){
            var arr = hash['per_message']['X-postfix-sender'].split(';');
            hash['per_message']['X-postfix-sender']='';
            hash['per_message']['X-postfix-sender']['type'] = arr[0] ? arr[0].trim() : '';
            hash['per_message']['X-postfix-sender']['addr'] = arr[1] ? arr[1].trim() : '';
        }
        if(hash['per_message']['Reporting-mta']){
            var arr = hash['per_message']['Reporting-mta'].split(';');
            hash['per_message']['Reporting-mta']='';
            hash['per_message']['Reporting-mta']['type'] = arr[0] ? arr[0].trim() : '';
            hash['per_message']['Reporting-mta']['addr'] = arr[1] ? arr[1].trim() : '';
        }
        //Per-Recipient DSN fields
        for(i=0; i<hash['per_recipient'].length; i++){
            var temp = this.standard_parser(hash['per_recipient'][i].split("\r\n"));
            var arr = temp['Final-recipient']? temp['Final-recipient'].split(';') : [];
            temp['Final-recipient'] = this.format_final_recipient_array(arr);
            //temp['Final-recipient']['type'] = trim(arr[0]);
            //temp['Final-recipient']['addr'] = trim(arr[1]);
            arr = (temp['Original-recipient']) ? temp['Original-recipient'].split(';') : ['', ''];
            temp['Original-recipient']='';
            temp['Original-recipient']['type'] = arr[0] ? arr[0].trim() : '';
            temp['Original-recipient']['addr'] = arr[1] ? arr[1].trim() : '';
            arr = (temp['Diagnostic-code']) ? temp['Diagnostic-code'].split(';') : ['', ''];
            temp['Diagnostic-code']='';
            temp['Diagnostic-code']['type'] = arr[0] ? arr[0].trim() : '';
            temp['Diagnostic-code']['text'] = arr[1] ? arr[1].trim() : '';
            // now this is wierd: plenty of times you see the status code is a permanent failure,
            // but the diagnostic code is a temporary failure.  So we will assert the most general
            // temporary failure in this case.
            var ddc=''; var judgement='';
            ddc = this.decode_diagnostic_code(temp['Diagnostic-code']['text']);
            judgement = this.get_action_from_status_code(ddc);
            if(judgement == 'transient'){
                if(temp['Action'].toLowerCase().indexOf('failed')!=-1){
                    temp['Action']='transient';
                    temp['Status']='4.3.0';
                }
            }
            hash['per_recipient'][i]='';
            hash['per_recipient'][i]=temp;
        }
        return hash;
    }
 
    this.get_head_from_returned_message_body_part = function(mime_sections){
		var head = {};
		if (mime_sections['returned_message_body_part']) {
			var temp = mime_sections['returned_message_body_part'].split("\r\n\r\n");
	        head = this.standard_parser(temp[1]);
	        head['From'] = this.extract_address(head['From']);
	        head['To'] = this.extract_address(head['To']);
	        head['MessageId'] = head['Message-id'];
		}
        return head;
    }
 
    this.extract_address = function(str){
        var from_stuff = str ? str.split(/[ \"\'\<\>:\(\)\[\]]/) : [];
		var from = null;
        for (var i = 0; i < from_stuff.length; ++i) {
			var things = from_stuff[i];
            if (things.indexOf('@')!=-1){from = things;}
        }
        return from;
    }
 
    this.find_recipient = function(per_rcpt){
        var recipient = '';
        if(per_rcpt['Original-recipient'] && per_rcpt['Original-recipient']['addr'] !== ''){
            recipient = per_rcpt['Original-recipient']['addr'];
        }
        else if(per_rcpt['Final-recipient'] && per_rcpt['Final-recipient']['addr'] !== ''){
            recipient = per_rcpt['Final-recipient']['addr'];
        }
        recipient = this.strip_angle_brackets(recipient);
        return recipient;
    }
 
    this.find_type = function(){
        if(this.looks_like_a_bounce)
            return "bounce";
        else if(this.looks_like_an_FBL)
            return "fbl";
        else
            return false;
    }
 
    this.parse_dsn_fields = function(dsn_fields){
		if(typeof dsn_fields == 'undefined') dsn_fields = [];
        else if(typeof dsn_fields == 'string') dsn_fields = dsn_fields.split(/\r\n\r\n/g);
        var j = 0;
		var hash = {
			'per_message': '',
			'per_recipient': []
		};
        for(var i=0; i<dsn_fields.length; i++){
            dsn_fields[i] = dsn_fields[i].trim();
            if(i==0)
                hash['mime_header'] = dsn_fields[0];
            else if(i==1 && !dsn_fields[1].match(/(Final|Original)-Recipient/)) {
                // some mta's don't output the per_message part, which means
                // the second element in the array should really be
                // per_recipient - test with Final-Recipient - which should always
                // indicate that the part is a per_recipient part
                hash['per_message'] = dsn_fields[1];
            }
            else {
                if(dsn_fields[i] == '--') continue;
                hash['per_recipient'][j] = dsn_fields[i];
                j++;
            }
        }
        return hash;
    }
 
    this.format_status_code = function(code){
        var ret = {};
		var matches = code.match(/([245])\.([01234567])\.([012345678])(.*)/);
        if(matches){
            ret['code'] = [matches[1], matches[2], matches[3]];
            ret['text'] = matches[4];
        }
        else {
			matches = code.match(/([245])([01234567])([012345678])(.*)/);
			if(matches){
            	ret['code'] = [matches[1], matches[2], matches[3]];
            	ret['text'] = matches[4];
			}
        }
        return ret;
    }
 
    this.fetch_status_messages = function(code){
		var rfc1893 = require('./rfc1893-error-codes');		
		var ret = this.format_status_code(code);
        var arr = ret['code'].split('.');
        var str = "<P><B>"+ rfc1893.status_code_classes[arr[0]]['title'] + "</B> - " +rfc1893.status_code_classes[arr[0]]['descr']+ "  <B>"+ rfc1893.status_code_subclasses[arr[1]+"."+arr[2]]['title'] + "</B> - " +rfc1893.status_code_subclasses[arr[1]+"."+arr[2]]['descr']+ "</P>";
        return str;
    }
 
    this.get_action_from_status_code = function(code){
        if(code=='') return '';
        var ret = this.format_status_code(code);
        var stat = parseInt(ret['code'][0]);
        switch(stat){
            case(2):
                return 'success';
                break;
            case(4):
                return 'transient';
                break;
            case(5):
                return 'failed';
                break;
            default:
                return 'unknown';
                break;
        }
    }
 
    this.decode_diagnostic_code = function(dcode){
		if (!dcode) return '';
		var array = dcode.match(/(\d\.\d\.\d)\s/);
        if(array){
            return array[1];
        }
        else {
			array = dcode.match(/(\d\d\d)\s/);
			if (array) {
            	return array[1];
			}
        }
    }
 
    this.is_a_bounce = function(){
        if(this.head_hash['Subject'] && this.head_hash['Subject'].match(/(mail delivery failed|failure notice|warning: message|delivery status notif|delivery failure|delivery problem|spam eater|returned mail|undeliverable|returned mail|delivery errors|mail status report|mail system error|failure delivery|delivery notification|delivery has failed|undelivered mail|returned email|returning message to sender|returned to sender|message delayed|mdaemon notification|mailserver notification|mail delivery system|nondeliverable mail|mail transaction failed)|auto.{0,20}reply|vacation|(out|away|on holiday).*office/i)) return true;
        if(this.head_hash['Precedence'] && this.head_hash['Precedence'].match(/auto_reply/)) return true;
        if(this.head_hash['From'] && this.head_hash['From'].match(/^(postmaster|mailer-daemon)\@?/i)) return true;
        return false;
    }
     
    this.find_email_addresses = function(first_body_part){
        // not finished yet.  This finds only one address.
		var matches = first_body_part.match(/\b([A-Z0-9._%-]+@[A-Z0-9.-]+\.[A-Z]{2,4})\b/i);
        if(matches){
            return [matches[1]];
        }
        else
            return [];
    }
 
 
    // these functions are for feedback loops
    this.is_an_ARF = function(){
        if(this.head_hash['Content-type'] && this.head_hash['Content-type']['report-type'] && this.head_hash['Content-type']['report-type'].match(/feedback-report/)) return true;
        if(this.head_hash['X-loop'] && this.head_hash['X-loop'].match(/scomp/)) return true;
        if(typeof this.head_hash['X-hmxmroriginalrecipient'] != 'undefined')  {
            this.is_hotmail_fbl = true;
            this.recipient = this.head_hash['X-hmxmroriginalrecipient'];
            return true;
        }
        if(typeof this.first_body_hash['X-hmxmroriginalrecipient'] != 'undefined' )  {
            this.is_hotmail_fbl = true;
            this.recipient = this.first_body_hash['X-hmxmroriginalrecipient'];
            return true;
        }
        return false;
    }
     
    // look for common auto-responders
    this.is_an_autoresponse = function() {
		var matches = this.head_hash['Subject'].match(/^=\?utf-8\?B\?(.*?)\?=/);
        if (matches)
            subj = mimelib.decodeBase64(matches[1]);
        else
            subj = this.head_hash['Subject'];
        for (var i = 0; i < this.autorespondlist.length; ++i) {
			var a = this.autorespondlist[i];
            if (subj.match(new RegExp("/"+a+"/", "i"))) {
//echo "a , subj"; exit;
                this.autoresponse = this.head_hash['Subject'];
                return true;
            }
        }
        return false;
    }
     
     
     
    // use a perl regular expression to find the web beacon
    this.find_web_beacon = function(body, preg){
        if(typeof preg == 'undefined' || !preg)
            return "";
		var matches = body.match(preg);
        if(matches)
            return matches[1];
    }
     
    this.find_x_header = function(xheader){
        var xheader = ucfirst(strtolower(xheader));
        // check the header
        if(typeof this.head_hash[xheader] != 'undefined'){
            return this.head_hash[xheader];
        }
        // check the body too
        var tmp_body_hash = this.standard_parser(this.body_hash);
        if(typeof(tmp_body_hash[xheader]) != 'undefined'){
            return tmp_body_hash[xheader];
        }
        return "";
    }
     
    this.find_fbl_recipients = function(fbl){
        if(typeof(fbl['Original-rcpt-to']) != 'undefined'){
            return fbl['Original-rcpt-to'];
        }
        else if(typeof(fbl['Removal-recipient']) != 'undefined'){
            return fbl['Removal-recipient'].replace(/--/g, '').trim();
        }
        //else if(){
        //}
        //else {
        //}
    }
 
    this.strip_angle_brackets = function(recipient){
		if (!recipient) return recipient;
        recipient = recipient.replace(/</g, '');
        recipient = recipient.replace(/>/g, '');
        return recipient.trim();
    }
 
 
    /*The syntax of the final-recipient field is as follows:
    "Final-Recipient" ":" address-type ";" generic-address
    */
    this.format_final_recipient_array = function(arr){
        var output = {'addr':'',
                        'type':''};
		if (arr.length) {
			if(arr[0].indexOf('@')!=-1){
	            output['addr'] = this.strip_angle_brackets(arr[0]);
	            output['type'] = (arr[1]) ? arr[1].trim() : 'unknown';
	        }
	        else{
	            output['type'] = arr[0].trim();
	            output['addr'] = this.strip_angle_brackets(arr[1]);
	        }
		}

        return output;
    }
}/** END class BounceHandler **/

exports.BounceHandler = BounceHandler;
