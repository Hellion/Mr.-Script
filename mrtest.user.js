// Mr. Script v1.6.9
//
// --------------------------------------------------------------------
// This is a user script.  To install it, you need Greasemonkey 0.8 or
// later. Get it at https://addons.mozilla.org/en-US/firefox/addon/748
// To uninstall, go to Tools/Manage User Scripts, select "Mr. Script",
// check "Also uninstall associated preferences" and click "Uninstall".
// Released under the GPL license: http://www.gnu.org/copyleft/gpl.html
// --------------------------------------------------------------------
//
// ==UserScript==
// @name        Mr. Test
// @namespace   /Hellion/MrTest
// @description	interface overhauler for KingdomofLoathing.com
// @version		1.6.9
// @author		Lukifer
// @contributor	Ohayou
// @contributor Hellion
// @contributor	Tard
// @contributor JiK4eva
// @contributor BeingEaten
// @contributor Picklish
// @contributor	CharonTheHand
// @include     http://127.0.0.1:60*/*
// @include		http://*localhost:*/*
// @include     http://*kingdomofloathing.com/*
// @exclude     http://images.kingdomofloathing.com/*
// @exclude     http://forums.kingdomofloathing.com/*
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @grant	GM_log
// @grant	GM_setValue
// @grant	GM_getValue
// @grant	GM_xmlhttpRequest
// @unwrap
// ==/UserScript==


var place = location.pathname.replace(/\/|\.(php|html)$/gi, "").toLowerCase();
//console.time("Mr. Script @ " + place);
//GM_log("at:" + place);

//var thePath = location.pathname;

var global = this;

//var server = location.host, serverNo = (server.match(/(.)\./) || {1:"L"})[1]; 	// the "7" in www7.X, or an "L" if no . is in the hostname.
																				// gonna be 'w' or 'v' all the time now (for www. or dev. )
//var pwd = GM_getValue('hash.' + server.split('.')[0]);

var autoclear = GetPref('autoclear');
var spoilers = GetPref('zonespoil') == 1;
GM_log("autoclear=" + autoclear +", spoilers="+spoilers);

anywhere(); // stuff we always add where we can

// town_right to cover gourds, and forestvillage for untinkered results...
//if (/^(adventure|choice|craft|knoll|shore|town_right|forestvillage)$/.test(place)) {
//	dropped_item();
//}
// where are we and what do we thus want to do?
var handler;
if ((handler = global["at_" + place])) {
	handler();
}
//if ((handler = spoilers && global["spoil_" + place])) {
//	handler();
//}

// no imperative top-level code below here; the rest is function definitions:

// ANYWHERE: stuff that we want to do on every possible occasion.
function anywhere() {
	if (autoclear) {
		$('input[value=1]').each(function(i) {
			AddAutoClear(this, autoclear);
		});
	}
}

// Dropped_Item: Add stuffy-stuff to dropped items.
//function dropped_item() {
//	$('img').each(function() {
//		var onclick = this.getAttribute("onclick");
//		if (/desc/.test(onclick || "")) {
//			AddLinks(onclick, this.parentNode.parentNode, null, thePath);
//		}
//	});
//}


function GetPref(which) {
	return GM_getValue("pref." + which);
}

// ONFOCUS: Make text input boxes clear on focus
function AddAutoClear(box, setting)
{	
	if (setting == 2) {
		$(box)
			.attr('onFocus', 'this.select();')
			.attr('onClick', 'this.select();')
			.attr('OnDblClick', 'this.select();');
	} else if (setting == 1) {
		$(box)
			.attr('onFocus', 'if (this.value==1) this.value="";')
			.attr('onClick', 'if (this.value==1) this.value="";')
			.attr('onBlur',  'if (this.value=="") this.value=1;');
	}	
}
