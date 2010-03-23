	/*
		PureJSTemplate
		Author: Mohammad S. Rahman
		License: MohammadLicense- use it, but quote me or I'll get you.
		Test: /test/purejstemplatetest.html
		
		Why use this: ITS FAST!!!
	*/
	(function($) {	
	$.fn.pureJSTemplate=function(options) {
		var tplID=options.id;
		var input= options.data;
		var tplObj=tplMap[tplID];
	
		if(!tplObj) {
			var tpl = document.getElementById(tplID).value;
			
			var leftjs=String.fromCharCode(21);
			var leftjsout=leftjs + "=";
			
			tpl=tpl.replace(replaceLeft, left+leftjs );
			
			var tplSplit = tpl.split(regexLeftRight);
			var js="var data=arguments[0];  var output=''; var ld='"+left+"'; var rd='"+right+"'; ";
			for(var i=0; i<tplSplit.length; i++) {
			
				var line = tplSplit[i];
		
				if(stringStartsWith(line, leftjsout)) {
					js+=" output+=" + line.substring(leftjsout.length) + "; ";
				}
				else if(stringStartsWith(line,leftjs)) {
					js+=" " + line.substring(leftjs.length) + " ";
				}
				else {
					js+=" output+='" + line.replace(replaceSingleQuote, "\\'").replace(replaceLineBreak, ' ')+ "'; ";
				}
			}
			js+=" return output;";
			
		
			tplObj = new Function(js);
			tplMap[tplID]=tplObj;
		}
		this.html(tplObj(input));
		return this;
	}
	var tplMap={};

	var left="<#";
	var right="#>";

	//Delimiters can have regex special characters in them; the following two variables will hold escaped versions of them
	var escapedLeft="<#"; 
	var escapedRight="#>";

	var specials= [ '$','^','?','/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\' ];
	var escapeRegex	= new RegExp( '(\\' + specials.join('|\\') + ')', 'g');

	var replaceLeft=new RegExp(escapedLeft, "g");
	var regexLeftRight= new RegExp(escapedLeft + "|" + escapedRight, "g");
	
	var replaceSingleQuote=new RegExp("'","g");
	var replaceLineBreak = new RegExp("\\r|\\n", "g");


	$.fn.pureJSTemplate.setDelimiters=function(l, r) {
		if(l!=r) {
			left=l;
			escapedLeft = left.replace(escapeRegex, '\\$1');	
			replaceLeft=new RegExp(escapedLeft, "g");
		
			right=r;
			escapedRight = right.replace(escapeRegex, '\\$1');	

			regexLeftRight= new RegExp(escapedLeft + "|" + escapedRight, "g");
		}
	}

	function stringStartsWith(str, startsWith) {
		return str.substring(0, startsWith.length)==startsWith;
	}

	})(jQuery);



