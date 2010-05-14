// Mr. Script v1.5.5
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
// @name        Mr. Script
// @namespace   http://www.noblesse-oblige.org/lukifer/scripts/
// @description Version 1.5.5
// @author		Lukifer
// @contributor	Ohayou
// @contributor Hellion
// @contributor	Tard
// @contributor JiK4eva
// @contributor BeingEaten
// @contributor Picklish
// @include     http://127.0.0.1:60*/*
// @include     http://*.kingdomofloathing.com/*
// @exclude     http://images.kingdomofloathing.com/*
// @exclude     http://forums.kingdomofloathing.com/*
// @require     http://ecmanaut.googlecode.com/svn/trunk/lib/gm/$x$X.js
// @require     http://ecmanaut.googlecode.com/svn/trunk/lib/gm/node.js
// @require     http://ajax.googleapis.com/ajax/libs/jquery/1.3.2/jquery.min.js
// @unwrap
// ==/UserScript==

var place = location.pathname.replace(/\/|\.(php|html)$/gi, "").toLowerCase();
//console.time("Mr. Script @ " + place);
//GM_log("at:" + place);

// n.b. version number should always be a 3-digit number.  If you move to 1.6, call it 1.6.0.  Don't go to 1.5.10 or some such.
var VERSION = 155;
var MAXLIMIT = 999;
var ENABLE_QS_REFRESH = 1;
var DISABLE_ITEM_DB = 0;
var ITEMDB_URL = "kolmafia.svn.sourceforge.net/viewvc/*checkout*/kolmafia/src/data/itemdescs.txt";

var thePath = location.pathname;
var itemDB = null;

var global = this, mr = unsafeWindow.top.mr = global;

var items = new Object();		// for new itemDB sourcing/parsing

makeTags("form,input".split(",")); // convenient node creation

// run eval(mr.script.call(this)) from the Firebug console to get script globals
mr.script = function script(x) {
	var stuff = [], target = this === global ? unsafeWindow.top : this;
	var privates = true; // stuff defined before our stuff is potentially harmful
	for (var id in global) {
		if (privates && "$x" != id) continue;
		privates = false;
		stuff.push(id);
		if ("script" == id) { // anything after our stuff is potentially harmful too
			 return "var " + stuff.map(function(n) { return n + " = this." + n; }).join(",");
		}
		target[id] = global[id];
	}
	return 'console.error("Failed to find Mr. Script global identifiers. :-(");';
};


var server = location.host, serverNo = (server.match(/(.)\./) || {1:"L"})[1]; // the "7" in www7.X, or an "L" if no . is in the hostname.
var pwd = GM_getValue('hash.' + server.split('.')[0]);

jQuery.prototype.toString = function() {
  return "[jQuery:" + this.length + "]";
};

var autoclear = GetPref('autoclear');
var spoilers = GetPref('zonespoil') == 1;

anywhere(); // stuff we always add where we can

// added town_right to cover untinkered results...
if (/^(adventure|choice|craft|fight|knoll|shore|town_right)$/.test(place)) {
	dropped_item();
}
// where are we and what do we thus want to do?
var handler;
if ((handler = global["at_" + place])) {
	handler();
}
if ((handler = spoilers && global["spoil_" + place])) {
	handler();
}

// no imperative top-level code below here; the rest is function definitions:

// --------------------------------------------------------------
// ANYWHERE: stuff that we want to do on every possible occasion.
// --------------------------------------------------------------
function anywhere() {
	if (autoclear) {
		$('input[value=1]').each(function(i) {
			AddAutoClear(this, autoclear);
		});
	}
}

// ------------------------------------------------
// Dropped_Item: Add stuffy-stuff to dropped items.
// ------------------------------------------------
function dropped_item() {
	if ("fight" == place && !/WINWINW/.test(document.body.innerHTML)) {
		return;
	}
	$('img').each(function() {
		var onclick = this.getAttribute("onclick");
		if (/desc/.test(onclick || "")) {
			AddLinks(onclick, this.parentNode.parentNode, null, thePath);
		}
	});
}

// ----------------------------------------------------------------------------
// Don't ask why this guy bothered to write wrapper functions. He just did. :-)
// ----------------------------------------------------------------------------
function persist(key, value) {
	try {
		GM_setValue(key, value);
	} catch(e) {
		console.error('Error while setting ' + key + ' to ' + value + ': ' + e.message);
	}
}

function integer(n) {
	return parseInt(n.replace(/^\D+|,/g, ""), 10);
}

function text(x) {
	switch (typeof x) {
	case "object":
		if ("undefined" != typeof x.textContent)
			return $.trim(x.textContent);
		break;
	case "string":
		return $.trim(x);
		break;
	}
	throw new Error("Failed to textify "+ x);
}

// Set/GetPref: store/retrieve data that applies to the script as a whole.
function SetPref(which, value) {
	persist("pref." + which, value);
}

function GetPref(which) {
	return GM_getValue("pref." + which);
}

// Set/GetData: store/retrieve data related to a particular session
function SetData(which, value) {
	persist(serverNo + which, value);
}

function GetData(which) {
	return GM_getValue(serverNo + which);
}

// Set/GetCharData: store/retrieve data related to a particular account/ascension
function SetCharData(which, value) {
	var charname = GetData("charname");
	persist(charname + which, value);
}
function GetCharData(which) {
	var charname = GetData("charname");
	return GM_getValue(charname + which);
}

// Password hash functions.  whee.
function SetPwd(hash) {
	persist('hash.' + server.split('.')[0], hash);
}
function FindHash() {
	GM_get(server + '/store.php?whichstore=m', function(html) {
		var hashIndex = html.indexOf("name=phash");
		var hash = html.substring(hashIndex+18, hashIndex+50);
		SetPwd(hash);
	});
}

// ----------------------------------------------------------
// new way to get item info, courtesy of LogiKol PriceGun...
// ----------------------------------------------------------
function getItemList(callback) 
{	
	GM_get(ITEMDB_URL,parseItems);
	function parseItems(itemList) {
		var currentTime = parseInt(new Date().getTime()/60000);
		GM_setValue("lastItemUpdate",currentTime);
		
		//remove double tabs... or don't, it's commented out where I got this from.  Hellion 11Jan10
		//itemList = itemList.replace(/\t\t/g,'\t');
		
		//remove trailing tabs		
		itemList = itemList.replace(/\t\r\n/g,'\r\n');
		
		//remove trailing spaces from lines
		itemList = itemList.replace(/ \r\n/g,'\r\n');
		
		//remove trailing spaces from item and description Ids
		itemList = itemList.replace(/ \t/g,'\t');
		
		//remove carriage returns
		itemList = itemList.replace(/\r/g,'');
		
		//split by line
		var a=itemList.split('\n');
		
		for(var i = 0; i < a.length; i++){
			if(/[0-9]/.test(a[i].charAt(0))) { 
				var split = a[i].split('\t'); 
				if(split[0] && split[1] && split[2]){
					items[split[1]]=[split[0],split[2]];
				}
			}
		}
		/*var itemsLength=0;
		for(a in items)itemsLength++;
		GM_log('parsed '+itemsLength+' items');*/

		GM_setValue('storedItemList',items.toSource());	// storedItemList should now be of the form array[descid]=[itemid,itemname].
		if( typeof callback=='function' ){
			callback();
		}
	}
}

function unstoreItemList(force) 
{	if (itemDB != null && force == null) return;		// if it's already set and we're not forcing a reload, get out.
	
	storedItemList = eval(GM_getValue('storedItemList','({})'));
	var itemListLength=0;
	for(var i in storedItemList){		// all we really care about is, is it empty or not?
		itemListLength++;				// not empty? great!
		break;							// don't waste time counting the whole damn list.
	}
	
	var currentTime = parseInt(new Date().getTime()/60000);	// convert from milliseconds to minutes
	var lastUpdate = GM_getValue("lastItemUpdate",1);
	
	//check every week.
	if(itemListLength==0 || (currentTime-lastUpdate)>10080) {	// that's a week's worth of minutes
		// let's refresh!
		getItemList(returnItemList);
	} else {
		returnItemList(true);
	}
	function returnItemList(skip) {
		if(!skip) {
			storedItemList = eval(GM_getValue('storedItemList','({})'));
		}
		itemDB = storedItemList;
	}
}

// end Steal-from-PriceGun section.
// --------------------------------

// -------------------------------------------------------------------------------------
// UpdateItemDB: retrieve a fresh copy of the item database from the server when needed.
// -------------------------------------------------------------------------------------

function UpdateItemDB(version)
{	// let's do things the new way.
	getItemList(returnItemList);
	function returnItemList(skip) {
		if(!skip) {
			storedItemList = eval(GM_getValue('storedItemList','({})'));
		}
		itemDB = storedItemList;
	}
	return;
}

function GetItemDB(force) 
{	
	unstoreItemList(force);
	return;
}

// -----------------------------------------------------------
// FINDMAXQUANTITY: Figure out how many MP restoratives to use
// -----------------------------------------------------------
function FindMaxQuantity(item, howMany, deefault, safeLevel)
{
	var min, max, avg, result;
	var hp = 0;

	switch(parseInt(item))
	{
		case 344: // Knob Goblin Seltzer
			min = 8; max = 12; break;
		case 345: // Knob Goblin Superseltzer
			min = 25; max = 29; break;
		case 347: // Dyspepsi-Cola
			min = 10; max = 14; break;
		case 357: // Mountain Stream Soda
			min = 6; max = 9; break;
		case 465: // Blue Pixel Potion
			min = 55; max = 79; break;
		case 466: // Green Pixel Potion
			min = 31; max = 40; break;
		case 518: // Magical Mystery Juice
			min = 4 + (1.5 * GetData("level")); max = min + 2; break;
		case 593: // Phonics Down
			min = 46; max = 50; break;
		case 592: // Tiny House
			min = 20; max = 24; break;
		case 882: // Blatantly Canadian
			min = 20; max = 25; break;
		case 1003: // Soda Water
			min = 3; max = 5; break;
		case 1334: // Cloaca-Cola
			min = 10; max = 14; break;
		case 1559: // Tonic Water
			min = 30; max = 50; break;
		case 1658: case 1659: case 1660: // Flavored Cloaca Colas
			min = 7; max = 9; break;
		case 1788: // Unrefined Mountain Stream Syrup
			min = 50; max = 60; break;
		case 1950: // Tussin
			min = 100; max = 100; break;
		case 1965: // Monsieur Bubble
			min = 45; max = 64; break;
		case 2616: // Magi-Wipes
			min = 50; max = 60; break;
		case 2600: // Lily
			min = 60; max = 70; break;
		case 2576: // Locust
			min = 34; max = 38; break;
		case 2389: // Monstar
		case 2367: // Soy! Soy!
			min = 70; max = 80; break;
		case 2639: // Black Cherry
			min = 9; max = 11; break;
		case 2035: // Marquis de Poivre Soda
			min = 30; max = 40; break;
		case 2370: // fennel Sooooooda
			min = 82; max = 120; break;
		case 2378: // banana spritzer
			min = 40; max = 100; break;
		case 2437: // New Cloke!
			min = 140; max = 160; break;
		case 2606: // palm-frond fan
			min = 35; max = 45; break;
		case 3357: // delicious moth
			min = 30; max = 40; break;
		case 3450: // cotton candy pinch
			min = 7;  max = 15; break;
		case 3451: // cotton candy smidgen
			min = 11; max = 23; break;
		case 3452: // cc skoche
			min = 15; max = 30; break;
		case 3453: // cc plug
			min = 19; max = 38; break;
		case 3454: // cc cone
			min = 26; max = 52; break;
		case 3455: // cc pillow
			min = 34; max = 68; break;
		case 3456: // cc bale
			min = 41; max = 82; break;
		
		case 3697: // high-pressure seltzer bottle
			min = 150;max = 200; break;
		case 3727: // Nardz	-- questionable data, went with conservative (i.e. high) values.
			min = 55; max = 85; break;
		case 4192: // sugar shard
			min = 5;  max = 10; break;

		case 231: // Doc G's Pungent Unguent
			min = 3; max = 5; hp = 1; break;
		case 232: // Doc G's Ailment Ointment
			min = 8; max = 10; hp = 1; break;
		case 233: // Doc G's Restorative Balm
			min = 13; max = 15; hp = 1; break;
		case 234: // Doc G's Homeopathic Elixir
			min = 18; max = 20; hp = 1; break;
		case 474: // Cast
			min = 15; max = 20; hp = 1; break;
		case 869: // Forest Tears
			min = 5; max = 10; hp = 1; break;
		case 1450: case 1451: case 1452: // Wads
		case 1453: case 1454: case 1455:
			if (howMany > 15) return 15;
			else return howMany; break;
		case 1154: case 1261: // Air, Hatorade
			if (howMany > 3) return 3;
			else return howMany; break;
		case 226: case 2096: // Minotaur, Bee Pollen
			if (howMany > 5) return 5;
			else return howMany; break;

		default:
			if (deefault == 1)
			{	if (howMany > MAXLIMIT) return MAXLIMIT;
				else return howMany;
			} else return 0;
	}

	switch(safeLevel)
	{	case 0: avg = (min+max)/2.0; break;
		case 1: avg = ((max*2)+min)/3.0; break;
		case 2: avg = max; break;
	}
	if (hp == 1) result = parseInt(GetData("maxHP")-GetData("currentHP"));
	else		 result = parseInt(GetData("maxMP")-GetData("currentMP"));
	if (result == 0) return 0;
	result = result / avg;
	if (result > howMany) result = howMany;
	if (result > 0)	return parseInt(result);
	else		return 1;
}


// -------------------------------------------------------------------------
// HASITEM: Parse HTML and determine if item is present and return quantity.
// -------------------------------------------------------------------------
// dead code now.... 04Mar10 Hellion
//function HasItem(itemName, text)
//{	var index = text.indexOf(itemName);
//	if (index == -1) return 0;
//	var quantityText = text.substr(index+itemName.length+18, 15);
//	if (quantityText.indexOf('(') != -1)
//	{	quantityText = quantityText.split('<')[0];
//		quantityText = quantityText.split(')')[0];
//		quantityText = quantityText.split('(')[1];
//		if (parseInt(quantityText)) return parseInt(quantityText);
//		else return 1;
//	} else return 1;
//}


// ----------------------------------------------------
// GM_GET: Stolen gleefully from OneTonTomato. Tee-hee!
// ----------------------------------------------------
function GM_get(dest, callback, errCallback)
{	GM_xmlhttpRequest({
	  method: 'GET',
	  url: 'http://' + dest,
	  	onerror:function(error)
	  	{	if( typeof(errCallback)=='function' )
				callback(details.responseText);
			else GM_log("GM_get Error: " + error);
	  	},
		onload:function(details) {
			if( typeof(callback)=='function' ){
				callback(details.responseText);
}	}	});	}

// ---------------------------------------------------------------
// DESCTOITEM: Convert description ID to item entry from database.
// ---------------------------------------------------------------
function DescToItem(zeedesc)
{	GetItemDB();
	return itemDB[zeedesc.match(/[0-9]{6,10}/)];
}

// --------------------------------------------------
// APPENDLINK: Create link and return pointer to span
// --------------------------------------------------
function AppendLink(linkString, linkURL)
{
	var font = document.createElement('font');

	$(font)
		.attr('size', 1)
		.html(' ' + linkString);

	var link = document.createElement('a');

	$(link)
		.attr('href', linkURL)
		.attr('target', 'mainpane')
		.append(font);

	var finalSpan = document.createElement('span');
	$(finalSpan)
		//.html($(finalSpan).html() + ' ')
		.append(' ')
		.append(link);

	return finalSpan;
}

// returns a function bound to self (with additional args passed pre-populated)
function bind( func, self /*, param 1, param 2, ... */ ) {
	var params = [].slice.call( arguments, 2 );
	return function a( /* param1, ..., param n,   param n+1, ... */ ) {
		return func.apply( self, params.concat( [].slice.call( arguments ) ) );
	};
}

// comfy way of concatenating a bunch of nodes into a DocumentFragment
function FRAGMENT(nodes, doc) {
	doc = doc || document;
	var fragment = doc.createDocumentFragment();
	for (var i = 0, node; node = nodes[i]; i++ ) {
		if ("string" == typeof node)
			node = doc.createTextNode( node );
		fragment.appendChild(node);
	}
	return fragment;
}

function makeTags(names, doc) {
	function tagMaker(name, attrs, children) {
		console.log(name, attrs, children);
		var node = this.createElement( name );
		if ("object" != typeof attrs || $.isArray(attrs)) {
			children = attrs;
			attrs = null;
		}
		if (attrs) {
			for (var a in attrs)
				node.setAttribute(a, attrs[a]);
			if (attrs['class'])
				node.className = attrs['class'];
			if (attrs['style'])
				node.style.cssText = attrs['style'];
		}
		if (children) {
			if ($.isArray(children))
				node.appendChild( FRAGMENT(children, this) );
			else if (({ "string":1, "number": 1 })[typeof children])
				node.appendChild( this.createTextNode( children+"" ) );
			else if (children.tagName)
				node.appendChild( children );
		}
		return node;
	}
	names.forEach(function(name) {
		global[name.toUpperCase()] = bind(tagMaker, doc||document, name);
	});
}

// ---------------------------------------
// APPENDUSEBOX: Attach use multiple form.
// ---------------------------------------
function AppendUseBox(itemNumber, skillsForm, maxButton, appendHere) {
	function HIDDEN(name, value) {
		return INPUT({ type: "hidden", name: name, value: value });
	}
	var max = FindMaxQuantity(itemNumber, 999, 0, GetPref('safemax'));
	var text, form = appendHere.appendChild(FORM({ method:"post" }, [
		HIDDEN("action", "useitem"),
		HIDDEN("pwd", pwd),
		HIDDEN("whichitem", itemNumber),
		text = INPUT({ type: "text", "class": "text", value: 1, size: 2 }), " ",
		INPUT({ type: "submit", "class": "button", value: "Use" })
	]));

	if (skillsForm == 0) {
		form.setAttribute('action', 'multiuse.php');
		if (itemNumber == 829) form.setAttribute('action','inv_use.php');		// generalize this beyond anti-anti-antidotes if we ever need to.
		text.setAttribute('name', 'quantity');
		if (maxButton != 0) {
			MakeMaxButton(text, function(event) {
				var box = document.getElementsByName('quantity')[0];
				box.value = FindMaxQuantity(itemNumber, 999, 0, GetPref('safemax'));
			});
		}
	} else {
		form.setAttribute('action', 'inv_use.php');
		text.setAttribute('name', 'itemquantity');
		if (maxButton != 0) {
			MakeMaxButton(text, function(event) {
				var box = document.getElementsByName('itemquantity')[0];
				box.value = FindMaxQuantity(itemNumber, 999, 0, GetPref('safemax'));
			});
		}
	}
	text.addEventListener('keyup', function(event) {
		if (event.which == 77 || event.which == 88) { // 77 = 'm', 88 = 'x'
		  var whichItem = document.getElementsByName('whichitem')[0];
		  this.value = FindMaxQuantity(whichItem.value, 999, 0, GetPref('safemax'));
		}
	}, false);
}

// ---------------------------------------------
// APPENDBUYBOX: Return HTML for buying an item.
// ---------------------------------------------
function AppendBuyBox(itemNumber, whichStore, buttonText, noQuantityBox)
{
	var eventString = ""; var htmlString = ""; var quantityString;
	if (noQuantityBox == 1) quantityString = "hidden";
	else quantityString = "text";
	if (autoclear == 2) eventString = ' onFocus="this.select();"' +
		'onClick="this.select();" OnDblClick="this.select();"';
	else if (autoclear == 1) eventString =
	' onFocus="javascript:if(this.value==1) this.value=\'\';"' +
	' onClick="javascript:if(this.value==1) this.value=\'\';"' +
	' onBlur="javascript:if(this.value==\'\') this.value=1;" ';

	htmlString =
		'<center><form action="store.php" method="post">' +
		'<input type="hidden" name="whichstore" value="' + whichStore +
		'"><input type="hidden" name="buying" value="Yep.">' +
		'<input type="hidden" name="phash" value="' + pwd +
		'"><input type="' + quantityString + '" class="text" size="2" ' +
		'value="1" name="howmany"' + eventString +
		'> <input type="hidden" name="whichitem" value="' + itemNumber +
		'"><input type="submit" class="button" value="' + buttonText + '"></form></center>';

	return(htmlString);
}

// ----------------------------------------------------
// NUMBERLINK: Fine, you think of a good function name.
// ----------------------------------------------------
// causes clicking on a number to fill that number in to the first "quantity" or "itemquantity" field available.
function NumberLink(b)
{
	var num = b.textContent.split(' ')[0];
	while(num.indexOf(',') != -1) num = num.split(',')[0] + num.split(',')[1];
	num = parseInt(num);
	if (num < 26)
	{	var txt = b.textContent.substring(
			b.textContent.indexOf(' '),b.textContent.length);
		var func = "var q = document.getElementsByName(\"quantity\");" +
			"if(q.length==0) q = document.getElementsByName(\"itemquantity\");"+
			"if(q.length) q[0].value=" + num + "; return false;";
		b.innerHTML = "<a href='javascript:void(0);' onclick='" + func + "'>" + num + "</a>" + txt;
}	}

// ------------------------------------------------------
// APPENDOUTFITSWAP: Aren't unified interfaces just keen?
// ------------------------------------------------------
function AppendOutfitSwap(outfitNumber, text)
{
	var span = document.createElement('span');
	var button1 = 0; var hidden;

	hidden = document.createElement('input');
	$(hidden)
		.attr('name','swap')
		.attr('type','hidden')
		.attr('value',outfitNumber);
	button1 = document.createElement('input');
	$(button1)
		.attr('type','submit')
		.attr('class','button')
		.attr('value',text)
	.click(function()
	{	this.setAttribute('disabled','disabled');
		var backup = GetPref('backup');
		var which = $('input[name=swap]').val();
		if (which <= 0 || backup == "")
		{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname =
				'/inv_equip.php?action=outfit&which=2&whichoutfit=' + which + '&pwd=' + pwd;
		} else
		{	GM_get(server +
			'/inv_equip.php?action=customoutfit&which=2&outfitname=' + backup + '&pwd=' + pwd,
			function(response)
			{	var which = $('input[name=swap]').val();
				top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname =
					'/inv_equip.php?action=outfit&which=2&whichoutfit=' + which + '&pwd=' + pwd;
			});
		}
		return false;
	});
	$(span)
		.append(button1)
		.append(hidden);

	// Revert to backup
	if (outfitNumber == 0)
	{	GM_get(server + "/account_manageoutfits.php", function(response)
		{
			var swap = $('input[name=swap]');
			var val; var index2; var backup = GetPref('backup');
			var index = response.indexOf(' value="' + backup + '"');
			if (index != -1) index = response.indexOf('name=delete',index) + 11;
			if (index != -1) index2 = response.indexOf('>',index);
			if (index != -1 && index2 != -1)
			{	val = '-' + response.substring(index,index2);
				swap.attr('value',val);
			} else
			{	swap.prev()
					.attr('disabled','disabled')
					.val('Backup Outfit Unavailable');
			}
		});
	} return span;
}

// -----------------------------------------------------------------------------
// ADDINVCHECK: Extra links for items, independently of where they're displayed.
// -----------------------------------------------------------------------------
function AddInvCheck(img)
{	// Special thanks to CMeister for the item database and much of this code, 
	// even though we don't use his itemDB anymore and the code probably no 
	// longer remotely resembles what he wrote originally either.
	if (img != undefined && img.getAttribute("onclick").indexOf("desc") != -1)
	{	
		if ($(img).parents("table.item").size() > 0) return;	// this image already has an RCM attached; don't override.
																// (thank you, CDMoyer, for this idea!)
		img.addEventListener('contextmenu', function(event)
		{	if (this.getAttribute("done")) return;
			GetItemDB(); 
			if (itemDB == null) 
			{	GM_log("null itemDB in AddInvCheck()");
				return;
			}
			item = DescToItem(this.getAttribute("onclick"));
			var add = "<br><span class='tiny' id='span" + item[0] + "'></span>";	// was item['itemid']
			this.parentNode.nextSibling.innerHTML += add;

			GM_get(server+'/js_inv.php?for=MrScript',function(details) {
				// this call will either get us the raw invcache data in the form of {"id":"qty","id":"qty",etc}
				// or a full HTML page containing the javascript that eventually says 'var inventory = {"id":"qty","id":"qty",etc};'
				// so if we don't get something that starts with the { character, assume we got the full javascript source
				// and break it down to just the inventory info that we want here.
				// n.b. JS source file version should no longer arrive as of 11Jan10, but we'll play it safe.
				if (details[0] != '{') {		
					var i1 = details.split('inventory = ')[1].split(';')[0];	// should get everything from { to }, inclusive.
					details = i1;
				}
				var invcache = eval('('+details+')');
				var itemid = item[0];		
				var itemqty = invcache[itemid];	if (itemqty === undefined) itemqty = 0;
				var addText = "";
				if (itemid == 1605) // catalysts
				{	var reagents = invcache[346]; if (reagents === undefined) reagents = 0;
					var solutions = invcache[1635]; if (solutions === undefined) solutions == 0;
					addText = "(" + reagents + " reagent"; if (reagents != 1) addText += "s";
					addText += ", " + itemqty + " catalyst"; if (itemqty != 1) addText += "s";
					addText += " and " + solutions + " scrummie"; if (solutions != 1) addText += "s";
					addText += " in inventory)";
				}
				else if (itemid == 1549) // MSG
				{	var noodles = invcache[304]; if (noodles === undefined) noodles = 0;
					addText = "(" + noodles + " noodle"; if (noodles != 1) addText += "s";
					addText += " and " + itemqty + " MSG"; if (itemqty != 1) addText += "s";
					addText += " in inventory)";
				}
				else addText = '('+itemqty+' in inventory)';
				document.getElementById('span'+item[0]).innerHTML += addText;	
			});
			this.setAttribute("done","done"); event.stopPropagation(); event.preventDefault();
		}, true);
	}	
}

// ----------------------------------------------------------
// ADDTOPLINK: Much easier for a function to do all the work.
// ----------------------------------------------------------
function AddTopLink(putWhere, target, href, html, space)
{
	if (href == "") return;
	var a = document.createElement('a');
	if (target != 0) a.setAttribute('target', target);
	a.setAttribute('href', href);
	a.innerHTML = html;

	putWhere.appendChild(a);
	if (space) putWhere.appendChild(document.createTextNode(" "));
}

// -----------------------------------------------------------------------------
// ADDLINKS: Extra links, etc. for items, independently of where they are.
// -----------------------------------------------------------------------------
function AddLinks(descId, theItem, formWhere, path) {
  // Special thanks to CMeister for the item database and much of this code
	var daitm = DescToItem(descId);
	if(!daitm) 
	{	GM_log("null description in AddLinks()");
		return '';
	}
	var itemNum = daitm[0];	
	AddInvCheck(theItem.firstChild.firstChild);

	var doWhat, addWhere = $(theItem).children().eq(1);

	switch (integer(itemNum)) {
		case  518: case  344: case 2639: case 1658: case 1659: case 1660:		// MP restorers.  link to skillcasting.
			doWhat = 'skill'; break;

		case   14: case   15: case   16: case  196: case  340: case  341:		// spleen items.
		case  343: case  687: case  744: case 1261: case 1290: case 1512:
		case 1513: case 1514: case 1515: case 1605: case 2595: case 3368:
			doWhat = 'use'; break;

		case   20: case   21: case   22: case   33: case   59: case   71:		// various gear... RCM should make this obsolete.
		case  634: case 1465: case 1466: case 1467: case 1468: case 1469:
		case 1470: case 1471: case 1472: case 1473: case 1474: case 1475:
		case 1476: case 1477: case 1478: case 1479: case 1480: case 1481:
		case 1482: case 1483: case 1484: case 2302:
			doWhat = 'equip'; break;

		case  486: case 1916:													// talisman o' nam, spookyraven's specs.
			doWhat = 'equipacc'; break;

		case   69: case  146: case  438: case  440: case  678: case  829:		// various items and campground gear... RCM again?
		case 1274: case 1622: case 1650: case 1794: case 1963: case 2258:
		case 2344: case 2345: case 2346: case 2655: case 2660: case 2950:
		case 2963: case 2964: case 2965: case 3353:
			doWhat = 'oneuse'; break;

		case   55: case 1445: case 1446: case 1447: case 1448: case 1449:		// pepper and nuggets.
			doWhat = 'cook'; break;

		case 247:																// fermenting powder.
			doWhat = 'cocktail'; break;

		case 1438: case 1439: case 1440: case 1441: case 1442: case 1443:		// powders
		case 1444:
			doWhat = 'malus'; break;

		case   74: case   75: case   76:										// spooky temple stuff
			itemNum = 74; doWhat = 'oneuse'; break;

		case  275: case  191: case  313: case 1244: case 1245:	case 675:		// larva, boss bat bandana, KGKing items, dagon skull,
		case 2334:																// MacGuffin
			addWhere.append(AppendLink('[council]','council.php')); break;
			
		case 454: // rusty screwdriver
			addWhere.append(AppendLink('[untinker]','town_right.php?place=untinker')); break;
			
		case 134: // bitchin' meatcar
			addWhere.append(AppendLink('[guild]','guild.php?place=paco')); break;
			
		case  535: // bridge
			addWhere.append(AppendLink('[chasm]','mountains.php?orcs=1&pwd='+pwd)); break;
			
		case  727: // Hedge
			addWhere.append(AppendLink('[maze]', 'hedgepuzzle.php')); break;

		case 2267: // Mega Gem
			addWhere.append(AppendLink('[equip]', 'inv_equip.php?pwd='+ pwd +'&'+
				 'which=2&action=equip&whichitem=2267&slot=2'));
			break;

		case 2052: // Blackbird
			addWhere.append(AppendLink('[fly]', 'inv_familiar.php?pwd=' +
				 pwd + '&whichitem=2052&which=3')); break;

		case 2050: case 2051:	// bird parts
			addWhere.append(AppendLink('[bird]', 'craft.php?mode=combine' +
                                 '&action=craft&a=2050&b=2051&pwd=' + pwd +
                                 '&quantity=1')); GoGoGadgetPlunger(); break;
		
		case 1549: // MSG
			addWhere.append(AppendLink('[bam!]', 'guild.php?place=wok')); break;
			
		case 2441: // KG encryption key
			addWhere.append(AppendLink('[use map]','inv_use.php?pwd=' + pwd + '&which=3&whichitem=2442')); break;

		case   23: // gum
			if (document.referrer.indexOf('sewer') != -1 && path == "/store.php") 
			{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/sewer.php';
			} else 
			{	addWhere.append(AppendLink('[sewer]', 'sewer.php'));
			}
			break;

		case   42: // permit
			if (document.referrer.indexOf('hermit') != -1 && path == "/store.php") 
			{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/hermit.php';
			} else 
			{	addWhere.append(AppendLink('[hermit]', 'hermit.php'));
			}	
			break;

		case 1003: // soda
			addWhere
				.append(AppendLink('[mix]', 'craft.php?mode=cocktail'))
				.append(AppendLink('[still]', 'guild.php?place=still'));
			break;

		case   40: // casino
			if (document.referrer.indexOf('casino') != -1 && path == "/store.php") 
			{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/casino.php';
			} else
			{	addWhere.append(AppendLink('[casino]', 'casino.php'));
			}
			break;

		case  236: // cocktail
			if (document.referrer.indexOf('craft') != -1 && path == "/store.php")
			{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/craft.php?mode=cocktail';
			} else
			{	doWhat = 'cocktail';
			}
			break;

		case  157: // E-Z
			if (document.referrer.indexOf('craft') != -1 && path == "/store.php")
			{	top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/craft.php?mode=cook';
			} else
			{	doWhat = 'cook';
			}
			break;

		case  530: // spray paint
			addWhere.append(AppendLink('[the wall]', 'town_grafwall.php')); break;

		case   24: // Clover
			addWhere.append(AppendLink('[disassemble]', 'multiuse.php?pwd='+ pwd +
			         '&action=useitem&quantity=1&whichitem=24'));
			break;

		case  140: // Planks
			addWhere.append(AppendLink('[boat]', 'inv_use.php?pwd=' +
                                 pwd + '&which=3&whichitem=146')); break;

		case   47: // Roll
			addWhere
			.append(AppendLink('[casino]', 'casino.php'))
			.append(AppendLink('[rock+roll]', 'craft.php?mode=smith&' +
                           'action=craft&a=47&b=30&pwd='+ pwd + '&quantity=1'));
			//GoGoGadgetPlunger(); 	// was switched from paste to smith quite a while ago.
			break;

		case   52: // Strings
			addWhere.append(AppendLink('[twang]', 'craft.php?mode=smith&' +
                                 'action=craft&a=52&b=30&pwd='+ pwd +
                                 '&quantity=1')); 
			// GoGoGadgetPlunger(); // was switched from paste to smith quite a while ago.
			break;

		case  135: case  136: // Rims, Tires
			addWhere.append(AppendLink('[wheels]','craft.php?mode=combine&' +
                                 'action=craft&a=135&b=136&pwd='+ pwd +
                                 '&quantity=1')); GoGoGadgetPlunger(); break;

		case 2044: // MacGuffin
			addWhere.append(AppendLink('[read]',"diary.php?textversion=1")); break;

		case  485: // snakehead charrrm: make talisman
			addWhere.append(AppendLink('[man, o nam]', 'craft.php?mode=combine&' +
                                 'action=craft&a=485&b=485&pwd='+ pwd +
                                 '&quantity=1')); GoGoGadgetPlunger(); break;

		case 2338: // Pudding
			addWhere.append(AppendLink('[eat]','inv_eat.php?pwd='+ pwd +
                                 '&which=1&whichitem='+itemNum)); break;

		case 2064: // Forged documents
			addWhere.append(AppendLink('[shore]','shore.php')); break;
	}

  switch (doWhat) {
    case "equip":
		addWhere.append(AppendLink('[equip]', 'inv_equip.php?pwd='+ pwd + '&which=2&action=equip&whichitem=' + itemNum));
      break;

    case "equipacc":
		addWhere.append(AppendLink('[equip]', 'inv_equip.php?pwd='+ pwd +
                                 '&which=2&action=equip&whichitem='+ itemNum +
                                 "&slot=3"));
      break;

    case "oneuse":
      addWhere.append(AppendLink('[use]','inv_use.php?pwd=' + pwd + '&which=3&whichitem='+itemNum));
      break;

    case "use":
		if (formWhere != null)
		{	AppendUseBox(itemNum, 0, 0, formWhere.get(0));
		} else
		{  addWhere.append(AppendLink('[use]', 'multiuse.php?pwd=' +
			pwd + '&action=useitem&quantity=1&whichitem='+itemNum));
		}
		break;

    case "skill":
		if (formWhere != null)
		{	AppendUseBox(itemNum, 1, 1, formWhere.get(0));
		} else
        {	addWhere.append(AppendLink('[use]', 'inv_use.php?pwd='+ pwd +
			           '&action=useitem&bounce=skills.php?action=useditem&itemquantity=1&whichitem='+
                                   itemNum));
		}
		break;

    case "malus":
		addWhere.append(AppendLink('[malus]', 'guild.php?place=malus')); break;

    default:
		if (doWhat)
        {	addWhere.append(AppendLink('['+ doWhat +']', doWhat+'.php'));
		}
  }

  return doWhat;
}

// -------------------------------------------------
// RIGHTCLICKMP: Fill up with standard restoratives.
// -------------------------------------------------
function RightClickMP(event)
{	var json = GetCharData("mplist");
	if (json != undefined && json != "")
	{	var num = 0; var quant = 0; var list = eval('('+json+')');
			 if (list['518'])  num = "518";	// MMJ
		else if (list['344'])  num = "344";	// KG seltzer
		else if (list['2639']) num = "2639";// BCSoda
		else if (list['1658']) num = "1658";// Cherry Cloaca
		else if (list['1659']) num = "1659";// Diet Cloaca
		else if (list['1660']) num = "1660";// Regular Cloaca
		if (num > 0)
		{	quant = FindMaxQuantity(parseInt(num), list[num], 0, GetPref("safemax"));
//			var url = server + '/skills.php?action=useitem&whichitem='+num+"&itemquantity="+quant+'&pwd='+pwd;
			var url = server + '/inv_use.php?pwd='+ pwd +
			    '&action=useitem&bounce=skills.php?action=useditem&itemquantity='+quant+'&whichitem='+num;
//			GM_log("RC-MP: url="+url);
			GM_get(url, function(result)
				{	document.location.reload(); });
	}	} event.stopPropagation(); event.preventDefault(); return false;
}

// -------------------------------------------------
// RIGHTCLICKHP: Heal up with spells.
// -------------------------------------------------
function RightClickHP(event)
{	var json = GetCharData("hplist");
//	GM_log("rightclick HP... json ="+json);
	if (json != undefined && json != "")
	{
		var num = 0; var quant = 0; var list = eval('('+json+')');
		var order; var heal = GetData("maxHP") - GetData("currentHP");

		if (heal == 0) {
			GM_log("no healing needed.");
			return;
		}
		if(heal < 20) order = ['3009','5007','1007','1010','5011','3012'];
		else if(heal < 35) order = ['1010','5011','3012','3009','5007','1007'];
		else if(heal < 45) order = ['5011','1010','3012','3009','5007','1007'];
		else order = ['3012','5011','1010','3009','5007','1007'];

		for(i=0; i<6; i++) if(list[order[i]]) { num = order[i]; break; }
//		GM_log("num="+num);
		if (num > 0)
		{	var url = server+'/skills.php?action=Skillz&whichskill='+num+"&quantity="+1+'&pwd='+pwd;
//			GM_log("RC-HP: url="+url);
			GM_get(url, function(result)
				{	document.location.reload(); });
	}	} event.stopPropagation(); event.preventDefault(); return false;
}

// ----------------------------------------------------------------------------
// PARSESELECTQUANTITY: Figure out how many of a given restorative are present.
// ----------------------------------------------------------------------------
function ParseSelectQuantity(selectItem, endToken)
{	var index = selectItem.selectedIndex;
	var howMany = 1;
	if (selectItem.options[index].textContent.indexOf("(") != -1)
	{	howMany = selectItem.options[index].textContent;
		if (howMany.charAt(0) == '(') return 999999;
		howMany = howMany.split("(")[1];
		howMany = howMany.split(endToken)[0];
	} return parseInt(howMany);
}

// -----------------------------------------------------------------------------
// MAKEMAXBUTTON: Wrap a "max" button around a text box.
// -----------------------------------------------------------------------------
function MakeMaxButton(textField, funktion)
{
	var img = document.createElement('img');
	var table = document.createElement('table');
	var tr = document.createElement('tr');
	var td1 = document.createElement('td');
	var td2 = document.createElement('td');
	var stizzyle = 'border: 1px solid black; border-left: 0px; padding: 0px;';

	$(img).attr('src', 'data:image/gif;base64,R0lGODlhCQAQAPAAMf%2F%2F%2FwAAACwA' + 
						'AAAACQAQAAACGgSCaGvB7d6KM1HJLHa3nZxg2%2FRwo2RmJFAAADs%3D')

	.click(funktion)

	.mousedown(function()
	{	$(this).parent().attr('style',
		"background-color:#999999; " + stizzyle);
	})

	.mouseup(function()
	{	$(this).parent().attr('style', "background-color:#ffffff; " + stizzyle);
	});

	// I am a horrible, horrible hack. If anyone knows how to make it
	// impossible to drag the max image into the text box, I'm all ears.
	$(textField)
		.attr('style','border: none;')
		.before(table)
		.mouseover(function()
		{	if (this.value.length > 5) this.value = "1"; 
		});

	$(table)
		.attr('style', 'display: inline; vertical-align: bottom; ' +
			'border-spacing: 0px; padding: 0;')
		.append(tr);
	$(tr)
		.append(td1)
		.append(td2);
	$(td1)
		.attr('style', 'border: 1px solid black; padding: 1px;')
		.append(textField);
	$(td2)
		.attr('style', stizzyle)
		.append(img);
}

// ----------------------------------------------------------------------
// SKILLUSELIMIT: Calculate how many times various skills should be cast.
// ----------------------------------------------------------------------
function SkillUseLimit(skillNum)
{	var limit = 999999; var min = 0; var max = 0;
	var safeLevel = GetPref('safemax');
	switch(parseInt(skillNum))
	{	case 8000: case 8001: case 8002: limit = 3; break;	// 3 Tomes maximum.	
		case 3012: limit = 1;  break;						// Cannelloni Cocoon
		case 8200: case 8201: limit = 1; break;				// Grimoires
		case 45:   case 53: limit = 1; break;				// vent rage gland, summon crimbo candy
		case 3006: case 4006: case 5014: limit = 5; break;	// summon noodles, reagents, garnishes
		case 3009: min=10; max=30; break;					// lasagna bandages
		case 1007: min=10; max=20; break;					// tongue of the otter
		case 1010: min=30; max=40; break;					// tongue of the walrus
		case 5011: min=40; max=40; break;					// disco power nap
		case 5007: min=20; max=20; break;					// disco nap
		case 6020: case 6021: case 6022: 
		case 6023: case 6024: case 6025: limit = 10; break;	// AT Hobo skills
		case 6026: limit = 50; break;						// AT Sea skill
		case 6028: limit = 5; break;						// AT Trader skill (Inigo's)
	} 
	if (max != 0)
	{	var hp = GetData("maxHP") - GetData("currentHP");
		switch(safeLevel)
		{ 	case 0: limit = parseInt(0.5+hp/((min+max)/2.0)); break;
			case 1: limit = parseInt(0.5+hp/(((max*2)+min)/3.0)); break;
			case 2: limit = parseInt(0.5+hp/max); break;
		}	
	} 
	return limit;
}

// ---------------------------------------------
// ONFOCUS: Make text input boxes clear on focus
// ---------------------------------------------
function AddAutoClear(box, setting)
{	if (setting == 2)
	{	$(box)
			.attr('onFocus', 'this.select();')
			.attr('onClick', 'this.select();')
			.attr('OnDblClick', 'this.select();');
	} else if (setting == 1)
	{	$(box)
			.attr('onFocus', 'if(this.value==1) this.value="";')
			.attr('onClick', 'if(this.value==1) this.value="";')
			.attr('onBlur',  'if(this.value=="") this.value=1;');
}	}

// -----------------------------------------------------------
// GOGOGADGETPLUNGER: Convert meat-paste links to The Plunger.
// -----------------------------------------------------------
function GoGoGadgetPlunger()
{	if (GetData("plungeraccess") == "Y")
	{	$('a[href*="craft.php?mode=combine"]').each(function()
		{	href = this.getAttribute('href');
			href = href.replace('&a=','&item1=');
			href = href.replace('&b=','&item2=');
			href = href.replace('action=craft','action=combine');
			this.setAttribute("href", href.replace(
				"craft.php?mode=combine", "knoll.php?place=paster"));
		});
	}	
}

// --------------------------------------------------------
// BLACKBIRDSTUFF: GM_get callbacks that do blackbird mojo.
// --------------------------------------------------------
function BlackBirdStuff()
{
	this.innerHTML = '[flap, flap, flap]';

	// Fire callback to find current familiar
	GM_get(server + '/familiar.php', function(txt)
	{	var curfam = txt.match(/fam\([0-9]{1,3}\)/)
			.toString().match(/[0-9]{1,3}/).toString();
		SetData('curfam', curfam);

		// 2nd callback to equip blackbird
		GM_get(server + '/familiar.php?action=newfam&newfam=59&pwd='+
			pwd, function(txt2)
		{	//Now fire another callback to use the map
			GM_get(server + '/inv_use.php?pwd=' + pwd +
				'&which=3&whichitem=2054', function(txt3)
			{	// Redirect main pane to store
				top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname =
					'/store.php?whichstore=l';
				//...and another callback to put your familiar back
				var curfam = GetData('curfam');
				if(curfam > 0)
				GM_get(server + '/familiar.php?action=newfam&newfam=' +
					curfam + '&pwd=' + pwd, function(txt4)
				{
	});	});	});	});
}

// ------------------------------------------
// UNEQUIPUPDATE: Callback to unequip inline.
// ------------------------------------------
function UnequipUpdate(event)
{	var url = this.href;
	if (url.indexOf("http://") != -1) url = url.substring(7,url.length);
	GM_get(url);
	var asdf = $(this.parentNode).html(' ');
	asdf.prev().children('select').val(0);
	asdf.prev().prev().html(' ');
	event.stopPropagation(); event.preventDefault(); return false;
}

// -------------------------------------------------------------------
// EQUIPUPDATE: This is silly, but the alternatives were even sillier.
// -------------------------------------------------------------------
function EquipUpdate(txt, itm)
{	var equipped = '';
	if(itm == 8) equipped = txt.indexOf(" equips an item:");
	else
	{	equipped = txt.indexOf("You equip");
		if(equipped == -1) equipped = txt.indexOf("Item equipped:");
	}
	var zel = document.getElementsByTagName('select')[itm];
	var giftd = zel.parentNode.previousSibling;

	if (equipped != -1)
	{	var zoik = txt.match(/http\:\/\/images.k[^\'\"]+gif/).toString();
		// Man, this is SO the stupid way to do this.
		if(itm == 8) zoik = txt.split(zoik)[1]
			.match(/http\:\/\/images.k[^\'\"]+gif/).toString();
		var dscnum = txt.match(/descitem\([0-9]{7,10}\)/);

		// New image
		giftd.innerHTML = '<img src="'+zoik+
			'" class="hand" onclick="descitem('+dscnum+');" />';

		// Change power and add unequip
		var oontd = zel.parentNode.nextSibling;
		var jqtd = $(oontd);

		// Strip out power and unequip links
		jqtd.children('font,a').remove();

		var pwr = "";
		if (itm < 5)
		{
			pwr = txt.split(zoik)[2].match(/\(Power[^\)]+\)/).toString();

			if (itm == 2)
			{	var oh = document.getElementsByTagName('select')[3];
				if (pwr.indexOf("1h") != -1)
				{	if(jqtd.children('font:contains(1h)'))
						top.frames[2].location.reload(); // Dammit.
				} else
				{	zel.setAttribute('hands','2');
					if (oh.firstChild.value != 0)
					{	oh.appendChild(document.createElement('option'));
						oh.firstChild.value = 0;
					} oh.selectedIndex = 0;
					oh.parentNode.previousSibling.innerHTML = "";
					oh.parentNode.nextSibling.innerHTML = "";
					oh.setAttribute('disabled','disabled');
			}	}
		}

		var unq = ["hat","shirt","weapon","offhand","pants",
					"acc1","acc2","acc3","familiarequip"];

		var uneqlnk = document.createElement('a');
		uneqlnk.innerHTML = '<font size="1">[unequip]</font>';
		uneqlnk.addEventListener("click", UnequipUpdate, true);
		uneqlnk.setAttribute('href', 'inv_equip.php?pwd='+pwd+
			'&which=2&action=unequip&type='+unq[itm]);

		//if(pwr != '')
		pwr += ''; //pwr = '&nbsp;' + pwr;
		var sigh = document.createElement('font');
		sigh.setAttribute('size','1');
		//sigh.innerHTML = "&nbsp;"+pwr;//+'&nbsp;';
		sigh.innerHTML = pwr + ' ';

		jqtd.append(sigh)
			.append(uneqlnk);
	} else
	{	zel.setAttribute('value',zel.getAttribute('previtem'));
		var zoik = zel.getAttribute('previmg');
		if (zoik != 0) giftd.firstChild.setAttribute('src',zoik);
		else giftd.removeChild(giftd.firstChild);
}	}

// --------------------------------------------------------------
// DEFAULTS: Pay no attention to the function behind the curtain.
// --------------------------------------------------------------
function Defaults(revert)
{
	if (revert == 0)
	{	if (GetPref('splitinv') == undefined)	SetPref('splitinv', 1);
		if (GetPref('splitquest') == undefined)	SetPref('splitquest', 1);
		if (GetPref('splitmsg') == undefined)	SetPref('splitmsg', 0);
		if (GetPref('outfitmenu') == undefined)	SetPref('outfitmenu', 1);
		if (GetPref('shortlinks') == undefined) SetPref('shortlinks', 3);
		if (GetPref('autoclear') == undefined)	SetPref('autoclear', 1);
		if (GetPref('toprow') == undefined) 	SetPref('toprow', 1);
		if (GetPref('safemax') == undefined) 	SetPref('safemax', 1);
		if (GetPref('moveqs') == undefined) 	SetPref('moveqs', 2);
		if (GetPref('logout') == undefined) 	SetPref('logout', 1);
		if (GetPref('zonespoil') == undefined) 	SetPref('zonespoil', 1);
		if (GetPref('klaw') == undefined) 	SetPref('klaw', 1);
		if (GetPref('quickequip') == undefined)	SetPref('quickequip', 0);
		if (GetPref('nodisable') == undefined)	SetPref('nodisable', 0);
		if (GetPref('docuse') == undefined) 	SetPref('docuse', 0);
		if (GetPref('swordguy') == undefined) 	SetPref('swordguy', 'skills.php');
		if (GetPref('backup') == undefined) 	SetPref('backup', 'Backup');
		if (GetPref('telescope') == undefined) 	SetPref('telescope', 1);
//		if (GetPref('eatagain') == undefined) 	SetPref('eatagain', 0);
		if (GetPref('lairspoil') == undefined)	SetPref('lairspoil', 1);
		if (GetPref('moonslink') == undefined)  SetPref('moonslink', 1);
		
		if (GetPref('ascension_list') == undefined) SetPref('ascension_list','cooked key pies, exploded chef, exploded bartender, discarded karma, bought a skill');

		if (GetPref('menu1link0') == undefined) SetPref('menu1link0', 'market;town_market.php');
		if (GetPref('menu1link1') == undefined) SetPref('menu1link1', 'hermit;hermit.php');
		if (GetPref('menu1link2') == undefined) SetPref('menu1link2', 'untinker;town_right.php?place=untinker');
		if (GetPref('menu1link3') == undefined) SetPref('menu1link3', 'mystic;mystic.php');
		if (GetPref('menu1link4') == undefined) SetPref('menu1link4', 'hunter;bhh.php');
		if (GetPref('menu1link5') == undefined) SetPref('menu1link5', 'guildstore');
		if (GetPref('menu1link6') == undefined) SetPref('menu1link6', 'demon;store.php?whichstore=m');
		if (GetPref('menu1link7') == undefined) SetPref('menu1link7', 'doc;galaktik.php');
		if (GetPref('menu1link8') == undefined) SetPref('menu1link8', 'lab;store.php?whichstore=g');
		if (GetPref('menu1link9') == undefined) SetPref('menu1link9', 'fruit;store.php?whichstore=h');

		if (GetPref('menu2link0') == undefined) SetPref('menu2link0', 'buy;searchmall.php');
		if (GetPref('menu2link1') == undefined) SetPref('menu2link1', 'trade;makeoffer.php');
		if (GetPref('menu2link2') == undefined) SetPref('menu2link2', 'sell;managestore.php');
		if (GetPref('menu2link3') == undefined) SetPref('menu2link3', 'collection;managecollection.php');
		if (GetPref('menu2link4') == undefined) SetPref('menu2link4', 'closet;closet.php');
		if (GetPref('menu2link5') == undefined) SetPref('menu2link5', 'hagnk\'s;storage.php');
		if (GetPref('menu2link6') == undefined) SetPref('menu2link6', 'attack;pvp.php');
		if (GetPref('menu2link7') == undefined) SetPref('menu2link7', 'wiki;http://kol.coldfront.net/thekolwiki/index.php/Main_Page');
		if (GetPref('menu2link8') == undefined) SetPref('menu2link8', 'calendar;http://noblesse-oblige.org/calendar');
		if (GetPref('menu2link9') == undefined) SetPref('menu2link9', ';');
	}
	else if (revert==1) // I'm definitely going to hell.
	{	SetPref('menu1link0', 'market;town_market.php');
		SetPref('menu1link1', 'hermit;hermit.php');
		SetPref('menu1link2', 'untinker;town_right.php?place=untinker');
		SetPref('menu1link3', 'mystic;mystic.php');
		SetPref('menu1link4', 'hunter;bhh.php');
		SetPref('menu1link5', 'guildstore');
		SetPref('menu1link6', 'demon;store.php?whichstore=m');
		SetPref('menu1link7', 'doc;galaktik.php');
		SetPref('menu1link8', 'lab;store.php?whichstore=g');
		SetPref('menu1link9', 'fruit;store.php?whichstore=h');
	} else if (revert==2)
	{	SetPref('menu2link0', 'buy;searchmall.php');
		SetPref('menu2link1', 'trade;makeoffer.php');
		SetPref('menu2link2', 'sell;managestore.php');
		SetPref('menu2link3', 'collection;managecollection.php');
		SetPref('menu2link4', 'closet;closet.php');
		SetPref('menu2link5', 'hagnk\'s;storage.php');
		SetPref('menu2link6', 'attack;pvp.php');
		SetPref('menu2link7', 'wiki;http://kol.coldfront.net/thekolwiki/index.php/Main_Page');
		SetPref('menu2link8', 'calendar;http://noblesse-oblige.org/calendar');
		SetPref('menu2link9', ';');
}	}

// ------------------------------------------------
// ADDTOPOPTION: Add a menu option in compact mode.
// ------------------------------------------------
function AddTopOption(name, url, select, putBefore)
{	var option = document.createElement('option');
	option.innerHTML = name; option.value = url;
	if (putBefore == 0) select.appendChild(option);
	else select.insertBefore(option, putBefore);
}

// -----------------------------------
// MAKEOPTION: Does what it says. Yup.
// -----------------------------------
function MakeOption(text, num, pref, opt1, opt2)
{
	var table = document.createElement('table');
	var tr = document.createElement('tr');
	var td = document.createElement('td');
	var prefVal = GetPref(pref);
	var select;

	if (num == -2) td.innerHTML = "<input style='font-size:11px;width:70px;' name=" + pref +
	"tag maxlength=16 type=text class=text value=" + text + ">";
	else td.innerHTML = "<span style='font-size:12px;padding-right:3px;'>" + text + "</span>";
	if (num == -1) td.setAttribute('width','50%');
	else if (num == -2) td.setAttribute('width','30%');
	else td.setAttribute('width','65%');
	td.setAttribute('align','right');
	tr.appendChild(td);

	td = document.createElement('td');
	if (num < 0) // Man, am I sneaky.
	{	select = document.createElement('input');
		select.setAttribute('type','text');
		select.setAttribute('class','text');
		select.setAttribute('maxlength','256');
		if (num == -2)
		{	var preflink = prefVal.split(';')[1];
			if (preflink != undefined) select.setAttribute('value', preflink);
			else select.setAttribute('value', '');
		} else select.setAttribute('value', prefVal);
	} else
	{	select = document.createElement('select');
		for (var i=0; i<num; i++)
		{	var option = document.createElement('option');
			if (i == prefVal) option.setAttribute('selected',1);
			option.value = i; select.appendChild(option);
			if (i == 0 && opt1 != 0) option.innerHTML = opt1;
			if (i == 1 && opt2 != 0) option.innerHTML = opt2;
	}	}
	select.setAttribute('style','width:95%;font-size:11px;');
	select.setAttribute('name',pref);
	if (num > -2) select.addEventListener('change', function(event)
	{	if (this.selectedIndex != undefined)
			 SetPref(this.name, this.selectedIndex);
		else SetPref(this.name, this.value);
		switch(this.name)
		{	case 'shortlinks': case 'splitinv':
			case 'moveqs': case 'swordguy':
			case 'logout': case 'splitquest':
			case 'splitmsg':
				top.frames[0].location.reload(); break;
		} }, true);
	td.appendChild(select);
	tr.appendChild(td);
	table.setAttribute('width','280');
	table.setAttribute('align','center');
	table.appendChild(tr);

	return table;
}

// ----------------------------------------------------------------------------------------------------
// ADDTOTOPOFMAIN: insert an element at the top of the main frame, but under the combat bar if present.
// ----------------------------------------------------------------------------------------------------
// function yoinked from JHunz's island management thingy
function AddToTopOfMain(newElement,refDocument) {
	var fightElement = refDocument.evaluate('//b[contains(.,"Combat") and contains(.,"!")]/ancestor::tr[1]',refDocument,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
	if (fightElement) {
		fightElement.parentNode.insertBefore(newElement,fightElement);
	}
	else {
		var element = refDocument.getElementsByTagName("tr")[0];
		if (element && element.parentNode) {
			element.parentNode.insertBefore(newElement,element);
		}
	}
}

// ---------------------------------------------------------
// MAIN.HTML: Resize top pane a bit and store password hash.
// ---------------------------------------------------------
function at_main_c() {
	FindHash();
	setTimeout("if (frames[0].location == 'about:blank')" +
             "  frames[0].location = 'topmenu.php'", 1500);	// fix for top menu not always loading properly
	if (GetData("plungeraccess") == undefined || GetData("plungeraccess") == 0) {	// not set yet?  go check.
		GM_get(server + "/knoll.php",function(response)
		{	if (response != "")
			{	SetData("plungeraccess","Y");
			} else {
				SetData("plungeraccess","N");
			}
		});
	}
	
	$('tr:contains("Noob."):eq(1)').append(AppendLink('[Toot]','mtnoob.php?action=toot'));	// fresh from valhalla?  get things rolling.
	
	var update = GetData("Update");
	if (update != '') {
		$('table:first').before(update);
		SetData("Update",'');
	}
// may also want to add a check for Funkslinging here.
}

// -----------------------------------------------
// MAIN: call main_c if needed (todo: remove this)
// -----------------------------------------------
function at_main() {
//	GM_log("location.pathname="+location.pathname);
	if ((location.pathname == "/main.html") ||	
	  (location.pathname == "/main.php")) { 	
		at_main_c();
		return;
	}
}

// -----------------------------------------------
// GAME: look for updates and post link if needed.
// -----------------------------------------------
// n.b. game.php is the outermost, non-frame window that contains all the frames.
// 		as such, the script only sees it exactly once, when you're logging in.
function at_game() {
	var lastUpdated = parseInt(GM_getValue('MrScriptLastUpdate', 0));
	var currentHours = parseInt(new Date().getTime()/3600000);
	GetItemDB();
//	GM_log("currentHours:"+currentHours+", lastUpdate:"+lastUpdated);

	// If over X hours, check for updates
	if ((currentHours - lastUpdated) > 0)
	{
	GM_get("noblesse-oblige.org/hellion/scripts/MrScript.version.json",
		function(txt)
		{	txt = txt.replace(/\n/,'');		// strip carriage returns so that eval() doesn't blow up
//			GM_log("txt="+txt);
			var json = eval('('+txt+')');
			if(!json.version) return;
			var vnum = json.version.replace(/\./g, "");	// strip points: 1.4.3 => 143.
			if(!vnum) return;
//			GM_log("vnum="+vnum+",VERSION="+VERSION);
			if(parseInt(vnum) <= VERSION)		// number returned via lookup is not newer than what this script says it is...
			{	persist('MrScriptLastUpdate',
					parseInt(new Date().getTime()/3600000)); return;
			}
			// If we're still here, then we need an update link.
			var html =
'<div style="font-size:14px;text-decoration:none;text-align:center;">' +
'Mr. Script v' + json.version + ' is available!<br /><br />' +
'<a href="' + json.url1 + '" target="_blank">';
			if(json.url2 && json.url2.length > 0)
			html +=
'Uncompressed</a>&nbsp;&nbsp;&nbsp;&nbsp;<b>OR</b>' +
'&nbsp;&nbsp;&nbsp;&nbsp;<a href="' + json.url2 +
'" target="_blank">Minified</a>&nbsp;&nbsp;<span style="font-size:10px;"></span><br />';
			else html += 'Update</a><br />';
			html += (json.desc ?
			'<p style="margin:0 auto; text-align:left; font-size:10px;">'+
			json.desc+'</p>' : '<br />') + '</div>';
			SetData("Update",html);
//			$('table:first').before(html);
		});

		// Update item database
		if (itemDB.version != undefined) UpdateItemDB(itemDB.version);
	}
}

// ----------------------------------------------
// FIGHT: special processing for certain critters
// ----------------------------------------------
function at_fight() {
// code for NS Lair spoilers borrowed shamelessly from Tard's NS Trainer v0.8
	// monster name:[preferred combat item, funkslinging item, is this lair-spoilery, special treatment flag]
	var MonsterArray = {
	"a Beer Batter":["baseball","",1,0],
	"a best-selling novelist":["plot hole","",1,0],
	"a Big Meat Golem":["meat vortex","",1,0],
	"a Bowling Cricket":["sonar-in-a-biscuit","",1,0],
	"a Bronze Chef":["leftovers of indeterminate origin","",1,0],
	"a collapsed mineshaft golem":["stick of dynamite","",1,0],
	"a concert pianist":["Knob Goblin firecracker","",1,0],
	"the darkness":["inkwell","",1,0],
	" El Diablo":["mariachi G-string","",1,0],		// note: leading space is very important.  do not remove it.
	"an Electron Submarine":["photoprotoneutron torpedo","",1,0],
	"an endangered inflatable white tiger":["pygmy blowgun","",1,0],
	"an Enraged Cow":["barbed-wire fence","",1,0],
	"a fancy bath slug":["fancy bath salts","",1,0],
	"the Fickle Finger of F8":["razor-sharp can lid","",1,0],
	"a Flaming Samurai":["frigid ninja stars","",1,0],
	"a giant bee":["tropical orchid","",1,0],
	"a giant fried egg":["black pepper","",1,0],
	"a Giant Desktop Globe":["NG (","",1,0],
	"an Ice Cube":["hair spray","",1,0],
	"a malevolent crop circle":["bronzed locust","",1,0],
	"a possessed pipe-organ":["powdered organs","",1,0],
	"a Pretty Fly":["spider web","",1,0],
	"a Tyrannosaurus Tex":["chaos butterfly","",1,0],
	"a Vicious Easel":["disease","",1,0],
	"The Guy Made Of Bees":["antique hand mirror","",0,0],
	"an erudite gremlin":["band flyers","molybdenum magnet",0,1],
	"a vegetable gremlin":["band flyers","molybdenum magnet",0,1],
	"an A.M.C. gremlin":["band flyers","",0,1],
	"a spider gremlin":["band flyers","molybdenum magnet",0,1],
	"a batwinged gremlin":["band flyers","molybdenum magnet",0,1],
	" Ed the Undying":["band flyers","",0,0],
	"a pygmy headhunter":["--","",0,3],
	"a boaraffe":["--","",0,3],
	"a pygmy blowgunner":["--","",0,3],
	"a pygmy assault squad":["--","",0,3],
	"an ancient protector spirit":["--","",0,3],
	"a clingy pirate":["cocktail napkin","",0,0],
	"a tetchy pirate":["The Big Book of Pirate Insults","",0,4],
	"a toothy pirate":["The Big Book of Pirate Insults","",0,4],
	"a tipsy pirate":["The Big Book of Pirate Insults","",0,4]
	};
	
	var monsterName = document.getElementById('monname').innerHTML;
	var infight = GetData("infight");
	
	function setItem(sel, itemName) {
		for (var i=1; i < sel.options.length; i++) {
			if (sel.options[i].text.indexOf(itemName) != -1) {
				sel.options.selectedIndex = i;
				break;
			}
		}
	}
	
	// always process the pirate insult book if it's in the combat item list:
	$('option[value="2947"]').each(function(){
		var insultsList = GetCharData("insults"); if (insultsList == '') insultsList = "0;0;0;0;0;0;0;0";
		var insultsArray = insultsList.split(";");
		var numInsults = 0;
		for (var i=0;i<insultsArray.length;i++) {
			if (insultsArray[i]==1) numInsults++;
		}
		$(this).text("The Big Book of Pirate Insults ("+numInsults+"/8)");
	});
	
// PART 1: FIRST-ROUND STUFF
	if (infight != "Y") {	// first time through this particular fight?
		SetData("infight","Y");
		var monsterItem = MonsterArray[monsterName];
		if (monsterItem != undefined && GetPref('lairspoil') != 1 && monsterItem[2] == 1) return;	// found something, spoilers are off, and this is a spoilery monster?
		if (monsterItem != undefined) {	// let's do something specific with this critter.
			var dropdown = document.getElementsByName('whichitem');
			if (dropdown.length) setItem(dropdown[0], monsterItem[0]);
// shameless codeborrow	ends somewhere around here.
			if (monsterItem[1] != "") {	// is there a funkslinging preference given?
				dropdown = document.getElementsByName('whichitem2');
				if (dropdown.length) setItem(dropdown[0], monsterItem[1]);
			}
			// n.b. we set this in a separate long-term variable so that we can tweak it mid-fight if needed.
			SetData("special",monsterItem[3]);
		}
	}

// PART 2: SPECIAL-PROCESS STUFF
	if (GetData("special") != 0)	{	// in a fight with something special?
		switch (GetData("special"))
		{
			case 1:	// gremlins 
				var gremlininfo	= {	"a batwinged gremlin":[182, "hammer", 			"a bombing run over"],
									"a spider gremlin"	 :[183, "pair of pliers", 	"fibula with its mandibles"],
									"an erudite gremlin" :[184, "wrench", 			"automatic eyeball-peeler"],
									"a vegetable gremlin":[185, "screwdriver", 		"off of itself and"],
									"an A.M.C. gremlin"  :[186, "blah blah hruugh", "an A.M.C. gremlin"]};

				var zonetext = GetData("square");
//				GM_log("zonetext="+zonetext);
				var zone = zonetext ? parseInt(zonetext.match(/(\d+)/)[1]) : 0;
				
				// if the monster doesn't drop the item in this zone, or we see the "i-don't-have-it" message...
				if ((zone && (gremlininfo[monsterName][0] != zone)) ||
					(document.body.innerHTML.indexOf(gremlininfo[monsterName][2]) != -1)) { 	// gremlin showed the no-tool message?
//					GM_log("zone="+zone+", name="+monsterName+", gi[name][0]="+gremlininfo[monsterName][0]);
					var tr = document.createElement('tr');
					tr.innerHTML = '<tr><td><div style="color: red;font-size: 100%;width: 100%;text-align:center">' + 
									'<b>SMACK THE LITTLE BUGGER DOWN!</b></div></td></tr>';
					AddToTopOfMain(tr, document);
					SetData("special",2);	// mark them as non-tool gremlins.
				} else {								// the monster might drop the item.
					if (document.body.innerHTML.indexOf(gremlininfo[monsterName][1]) != -1) {	// and there it is!
						var tr = document.createElement('tr');
						tr.innerHTML = '<tr><td><div style="color: green;font-size: 100%;width: 100%;text-align:center">' +
										'<b>MAGNET IT NOW!</b></div></td></tr>';
						AddToTopOfMain(tr, document);
						
						var itemSelect = document.getElementsByName('whichitem');
						var funkSelect = document.getElementsByName('whichitem2');
						if (funkSelect.length) {
							setItem(itemSelect[0], "band flyer");
							setItem(funkSelect[0], "molybdenum magnet");
						} else {
							setItem(itemSelect[0], "molybdenum magnet");
						}
					} else {
						var tr = document.createElement('tr');
						tr.innerHTML = '<tr><td><div style="color: blue;font-size: 80%;width: 100%;text-align:center">' +
										'<b>Wait for it....</b></div></td></tr>';
						AddToTopOfMain(tr, document);
					}
				}
			break;
			
			case 2: // gremlins that we know don't have the tool:
				var tr = document.createElement('tr');
				tr.innerHTML = '<tr><td><div style="color: red;font-size: 100%;width: 100%;text-align:center">' +
								'<b>SMACK THE LITTLE BUGGER DOWN!</b></div></td></tr>';
				AddToTopOfMain(tr, document);
			break;
			
			case 3: // hidden city monsters--look for sphere messages.
				if (/You hold the \w+ \w+ \w+ up in the air./.test(document.body.innerHTML)) {
					var stone = {"mossy":2174, "smooth":2175, "cracked":2176, "rough":2177};
					var snRegex = /You hold the (\w+) stone sphere up in the air./g;
					var scRegex = /It radiates a bright (\w+) light,/g;
					var sname; 
					var color; 
					while ((sname = snRegex.exec(document.body.innerHTML)) != null) {	// loop to account for funkslung stones.
						color = scRegex.exec(document.body.innerHTML);
						switch (color[1]) 
						{
							case "yellow":	SetCharData("altar1",stone[sname[1]]); break;
							case "blue":	SetCharData("altar2",stone[sname[1]]); break;
							case "red":		SetCharData("altar3",stone[sname[1]]); break;
							case "green":	SetCharData("altar4",stone[sname[1]]);break;
						}
					}
				}
			break;
			case 4: // insulting pirates:
				var insultsList = GetCharData("insults"); if (insultsList == undefined) insultsList = "0;0;0;0;0;0;0;0";
				var insultsArray = insultsList.split(";");
				var numInsults = 0;
				var s = $('body').text();
//				GM_log("body text="+s);
				if (s.match("neither your tongue nor your wit is sharp enough")) {
					insultsArray[0] = 1;
				}
				else if (s.match("be any worse than the smell of your breath")) {
					insultsArray[1] = 1;
				}
				else if (s.match("tell your wife and sister I had a lovely time")) {
					insultsArray[2] = 1;
				}
				else if (s.match("yellow would be more your color")) {
					insultsArray[3] = 1;
				}
				else if (s.match("comfortable being compared to your girlfriend")) {
					insultsArray[4] = 1;
				}
				else if (s.match("honor to learn from such an expert in the field")) {
					insultsArray[5] = 1;
				}
				else if (s.match("do you manage to shave without using a mirror")) {
					insultsArray[6] = 1;
				}
				else if (s.match("only seems that way because you have")) {
					insultsArray[7] = 1;
				}
				for (var i=0;i<insultsArray.length;i++) {
					if (insultsArray[i]==1) numInsults++;
				}
				insultsList = insultsArray.join(";");
				SetCharData("insults",insultsList);
				$('p:contains("Dang, man.")').html("Dang, man.  That hurts.  <font color='blue'>("+numInsults+"/8 insults gathered.)</font>");
			break;
			default:
			break;
		}
	}

// PART 3: LAST-ROUND STUFF
	// post-win processing:	
	if (/WINWINW/.test(document.body.innerHTML)) {
		SetData("infight","N");
		SetData("special",0);
		var square=GetData("square");
		SetData("square",false);
		if (square) {
//			GM_log("square="+square);
			if (square.indexOf("hiddencity") != -1 || square.indexOf("rats.php") != -1) {	
				var thissquare = square.match(/(\d+)/)[1];	// break the "22" off of "rats.php?where=22", for example.
				var hloc = '';
				var lastsquare = 0;
				if (square.indexOf("hiddencity") != -1) {
					hloc = "hiddencity.php?which=";
					lastsquare=24;
				} else {
					hloc = "rats.php?where=";
					lastsquare=25;
				}
				var nextsquare = parseInt(thissquare)+1;
				if (nextsquare <= lastsquare) {
					var myhref = hloc+nextsquare;
					var clicky = "SetData('square','"+myhref+"')";
					$('<center><p><a href="'+myhref+'" id="bwahaha">Explore Next Square</a></center>').prependTo($('center:last'));
					$('#bwahaha').click(function() {
						var a = $(this);
						SetData("square",a.attr('href'));
					});
				}
			} else {	// handling adventure.php?snarfblat=X options.
				var location = parseInt(square.match(/(\d+)/)[1]);	// the 185 in "adventure.php?snarfblat=185"
				switch (location)	{
				case 182:
				case 183:
				case 184:
				case 185:	// add onclick to "adventure again" link to tell ourselves where we are.
					$('a:contains("dventure")').click(function() {
						var a = $(this);
						SetData("square",a.attr('href'));
					});
				break;
				}
			}
		}
		switch (monsterName) {
		case "a skeletal sommelier":
		case "a possessed wine rack":
			var winebits = {"Merlot":1,"Marsala":2,"Muscat":4,"Pinot Noir":8,"Port":16,"Zinfandel":32};
			var imgs = document.getElementsByTagName('img'); 
			if (imgs.length > 1) {		// image 0 is the monster pic.  anything else might be a drop.
				var dropcode = 0;
				for (var i=1; i<imgs.length;i++) {	
					var itemname = imgs[i].getAttribute('alt');
					if (itemname && itemname.indexOf("dusty bottle of") != -1) {
						itemname = itemname.slice(16);
						dropcode |= winebits[itemname];
					}
				}
				// save info about what wines dropped for the wine location solver.
				if (dropcode != 0) {
					var corner = "corner" + document.getElementsByTagName('a')[1].href.match(/snarfblat=(\d+)/)[1];
					var winesfound = GetCharData(corner);
					winesfound |= dropcode;
					SetCharData(corner, winesfound);
				}
			}
			break;
		case " Dr. Awkward":
			$("p:contains('Adventure')").html('<a href="inventory.php?which=2"><font size="4">CLICK HERE TO CHANGE YOUR GEAR</font></a>');
			$("p:contains('Go back to')").html('');
			break;
		}
		showYoinks(true);
	}
		// post-loss processing:
	else if (	/You lose.  You slink away,/.test(document.body.innerHTML) || 
				/You run away, like a sissy/.test(document.body.innerHTML) ||
				/>Go back to/.test(document.body.innerHTML)) {
		SetData("infight","N");
		SetData("special",0);
		SetData("square",false);
		showYoinks(false);
	}
// PART 4: ANY-ROUND STUFF	
	// yoinked-item processing
	else if (document.body.innerHTML.indexOf(">You acquire an item: <") != -1) {
		var imgs = document.body.getElementsByTagName("img");
		for (var i = 0; i < imgs.length; i++)
		{
			var img = imgs[i];
			if (img.getAttribute("class") != "hand")
				continue;
			// toast
			if (img.getAttribute("onClick") == "descitem(931984879)")
				continue;

			var text = img.parentNode.parentNode.parentNode.parentNode.parentNode.innerHTML;
			text = text.replace(/ acquire /, " yoinked "); 
			
			GM_setValue("yoink", GM_getValue("yoink", "") + text);
			break;
		}
	}
}

// ----------------------------------------
// SHOWYOINKS:  display pickpocketed items.
// ----------------------------------------
// Todo: figure out how to specify the correct placement via jquery....
function showYoinks(wonCombat) {
	var yoink = GM_getValue("yoink", "");
	if (yoink != "") {
		GM_setValue("yoink", "");
		var yoinkNode = document.createElement("table");
		yoinkNode.innerHTML = yoink;
		if (wonCombat) {
			var centers = document.body.getElementsByTagName("center");
			for (var i = 0; i < centers.length; i++) {
				if (centers[i].innerHTML.indexOf("You win the fight") == 0) {
					centers[i].insertBefore(yoinkNode, centers[i].childNodes[3]);
					break;
				}
			}
		} else {
			$('a:contains("dventure")').parent().prepend(yoinkNode);
		}
	}
}

// ---------------------------------------------------------------------
// LOGGEDOUT: Clear things that should only be checked once per session.
// ---------------------------------------------------------------------
function at_loggedout() {
  SetPwd(0);
  SetData("NSDoorCode",'');
  SetData("plungeraccess",'');
}

// ------------------------------------------------
// LOGIN: clear password hash, just to be safe. :-)
// ------------------------------------------------
function at_login() {
  SetPwd(0);
  SetData("NSDoorCode",'');
  SetData("plungeraccess",'');
}

// -------------------------------------------------------
// VALHALLA: clear things that may change when you ascend.
// -------------------------------------------------------
function at_valhalla() {
	// door code resets
	SetData("NSDoorCode",'');
	// might not go muscle sign this time
	SetData("plungeraccess",'');
	// wipe the cellar wine info
	SetCharData("corner178",0);
	SetCharData("corner179",0);
	SetCharData("corner180",0);
	SetCharData("corner181",0);
	SetCharData("winelist",'');
	SetCharData("wineHTML",'');
	SetCharData("winesNeeded",'');
	// clear the hidden city stone settings
	SetCharData("altar1",'');
	SetCharData("altar2",'');
	SetCharData("altar3",'');
	SetCharData("altar4",'');
	// reset pirate insult knowledge
	SetCharData("insults",'0;0;0;0;0;0;0;0');
}

// COVE: display pirate insult information
function at_cove() {
	var insultsList=GetCharData("insults");
	if (insultsList == undefined) { insultsList = "0;0;0;0;0;0;0;0"; SetCharData("insults",insultsList); }
	var insultsArray = insultsList.split(";");
	var numInsults = 0;
	for (var i=0;i<insultsArray.length;i++) {
		if (insultsArray[i]==1) numInsults++;
	}
	var iColor={0:"red",1:"red",2:"red",3:"red",4:"red",5:"maroon",6:"blue",7:"green",8:"green"}; 

	//Create the page element
	var newElement = document.createElement('tr');
	newElement.innerHTML = '<tr><td><div style="color: '+iColor[numInsults]+';font-size: 80%;width: 40%;text-align:left;">' + 'Insult tracking: ' + numInsults + '\/8</div></td></tr>';
	//Insert it at the top of the page
	var element = document.getElementsByTagName("tr")[0];
	element.parentNode.insertBefore(newElement,element);
}

// -----------------------------------------------------------------------
// HIDDENCITY: remove non-useful spherical objects from the dropdown list.
// -----------------------------------------------------------------------
// 2174=mossy, 2175=smooth, 2176=cracked, 2177=rough.
// altar 1=yellow, 2=blue, 3=red, 4=green.
function at_hiddencity() {
	SetData("square",false);		// if we click on an altar, unmark it.
	var ball = {1: 1900, 2: 1901, 3: 1904, 4: 1905};	// that's "altar:ID of ball that gives buff at this altar".
	var altarsrc = $('img:first').attr("src"); 
	if (altarsrc) {
		var altar = parseInt(altarsrc.charAt(altarsrc.indexOf("/altar") + 6));	// This will be a number from 1 to 4 on the right pages.
		var stone = GetCharData('altar'+altar);
		if ((stone != undefined) && (stone != '')) {
			$('option:not([value="'+stone+'"]):not([value="'+ball[altar]+'"])').remove();
		} else {
			$('option:not([value="2174"]):not([value="2175"]):not([value="2176"]):not([value="2177"]):not([value="'+ball[altar]+'"])').remove();
		}
	}
	$('a').click(function() {
		var a = $(this);
		SetData("square",a.attr('href'));
	});
}

// ----------------------------------------------------------------------------------
// RATS: track what square we clicked in order to provide "Explore Next Square" link.
// ----------------------------------------------------------------------------------
function at_rats() {
	$('a').click(function() {	
		var a = $(this);
		SetData("square",a.attr('href'));
	});
// add "next square" link when we click on a drink-dropping non-combat square.
	$('td:contains("You acquire an item")').each(function() {
		var td = $(this);
		var square=GetData("square");
		SetData("square",false);
		if (td.innerHTML.indexOf("shiny ring") != -1) return;	// no next square when we shut off the faucet.
		if (square) {
			var hloc = "rats.php?where=";
			var thissquare = square.match(/(\d+)/)[1];	// the "22" in "hiddencity.php?which=22" or "rats.php?where=22"
			var nextsquare = parseInt(thissquare)+1;
			if (nextsquare < 26) {
				var myhref = hloc+nextsquare;
				var clicky = "SetData('square','"+myhref+"')";
				$('<center><p><a href="'+myhref+'" id="bwahaha">Explore Next Square</a></center>').appendTo($(this).parent().parent());
				$('#bwahaha').click(function() {
					var a = $(this);
					SetData("square",a.attr('href'));
				});
			}
		}	
	});
}

// ------------------------------------------------------------------------------------------
// ADVENTURE: provide "Explore next square" link when we hit a non-combat in the Hidden City.
// ------------------------------------------------------------------------------------------
function at_adventure() {
	var square=GetData("square");
	SetData("square",false);
	if (square) {
		var hloc = '';
		if (square.indexOf("hiddencity") != -1) hloc = "hiddencity.php?which=";
//		else if (square.indexOf("rats") != -1) hloc = "rats.php?where=";	// I don't believe this can ever happen, actually.
		if (hloc == '') return;
		var thissquare = square.match(/(\d+)/)[1];	// the "22" in "hiddencity.php?which=22" or "rats.php?where=22"
		var nextsquare = parseInt(thissquare)+1;
		if (nextsquare < 25) {
			var myhref = "hiddencity.php?which="+nextsquare;
			var clicky = "SetData('square','"+myhref+"')";
			$('<center><p><a href="'+myhref+'" id="bwahaha">Explore Next Square</a></center>').prependTo($('center:last'));
			$('#bwahaha').click(function() {
				var a = $(this);
				SetData("square",a.attr('href'));
			});
		}
	}
}

// --------------------------------------------------------------------------------------------------
// CHOICE: clear out "square" since it should never persist outside of the hidden city or the tavern.
// --------------------------------------------------------------------------------------------------
function at_choice() {
	SetData("square",false);
}

// ----------------------------
// TOWN_RIGHT: Untinker linker.
// ----------------------------
function at_town_right() {
	var linkloc = GetData("plungeraccess")=="Y" ? "knoll.php?place=smith" :"adventure.php?snarfblat=18"
	if (document.location.search == "?place=untinker") {
		$('p').each(function()
		{	var p = $(this);
			var txt = p.text();
			if (txt.indexOf('get it back for me?') != -1) p.append(AppendLink('[get it from innabox]',linkloc));
		});
		foo = document.getElementsByTagName('center');
		if (foo.length == 0) return;
		if (foo[1].textContent.indexOf('finding my screwdriver?') != -1)
		{ foo[1].appendChild(AppendLink('[get it from innabox]',linkloc));
		}
		if (GetData("plungeraccess")=="Y") $('b:eq(1)').append(AppendLink('[innabox]',linkloc)); 
	}
}

// ---------------------------------------------
// BHH: provide some convenience links here too.
// ---------------------------------------------
function at_bhh() {
	var bountyloc = [
		//item name, link display, adventure location ID
		["bloodstained briquettes","[Knob Outskirts]","114"],
		["empty greasepaint tubes","[Funhouse]","20"],
		["chunks of hobo gristle","[Back Alley]","112"],
		["oily rags","[Knoll]","18"],
		["pink bat eyes","[Bathole Entry]","30"],
		["shredded can labels","[Pantry]","113"],
		["triffid barks","[spooky forest]","15"],
		["bits of wilted lettuce","[Fern's Tower]","22"],
		["broken petri dishes","[Knob Lab]","50"],
		["bundles of receipts","[Knob Treasury]","41"],
		["callused fingerbones","[South Of Border]","45"],
		["empty aftershave bottles","[frat house]","27"],
		["greasy dreadlocks","[hippy camp]","26"],
		["vials of pirate sweat","[pirate's cove]","66"],
		["balls of white lint","[Whitey's Grove]","100"],
		["worthless pieces of yellow glass","[Dungeons of Doom]","39"],
		["billy idols","[Goatlet]","60"],
		["burned out arcanodiodes","[Airship]","81"],
		["coal buttons","[Ninja Snowmen]","62"],
		["discarded pacifiers","[Castle]","82"],
		["disintegrating corks","[Wine Cellar]","178"],
		["non-Euclidean hooves","[Louvre]","106"],
		["sammich crusts","[Roflmfao]","80"],
		["bits of sticky stardust","[Hole in the Sky]","83"]
	];
	// going back to see the BHH gives the relevant text in the first <p>.
	$('p:first').each(function()
	{	var p = $(this);
		var txt = p.text();
		for (var i=0; i<bountyloc.length; i++) if (txt.indexOf(bountyloc[i][0]) != -1) {
			p.append(AppendLink(bountyloc[i][1],"adventure.php?snarfblat="+bountyloc[i][2]));
			break;
		}
	});
	// visiting the BHH for the first time gives the text in the first <td> of the second <table>.
	// going back to see the BHH subsequently also gives the text in the first <td>, but that <td> also encompasses the rest of the form.
	$('table:eq(1) td:first').each(function()
	{	var p = $(this);
		var txt = p.text();
		if (txt.indexOf("Manual of Transcendent Olfaction") != -1) return;	// we'll be modifying the <p> above instead.
		for (var i=0; i<bountyloc.length; i++) {
			if (txt.indexOf(bountyloc[i][0]) != -1) {
				p.append(AppendLink(bountyloc[i][1],"adventure.php?snarfblat="+bountyloc[i][2]));
				break;
			}
		}
	});
}

// ---------------------------------------------------
// SEARCHMALL: the new, improved mall search/buy page.
// ---------------------------------------------------
// function at_searchmall() 
// {	at_mallstore();			// I need to make a unique function for this....  05Jan10 Hellion
// }

// ---------------------------------------------------------
// MALLSTORE: add fun links to (some of) the things you buy!
// ---------------------------------------------------------
function at_mallstore()
{	var img = document.images[0];
	if (img == undefined) return;
	var onclick = img.getAttribute("onclick");
	if (onclick != undefined && onclick.indexOf("desc") != -1)
	{	AddLinks(onclick, img.parentNode.parentNode, img.parentNode.parentNode.parentNode.parentNode.parentNode, thePath);
	}
	for (var i=1,len=document.images.length; i<len; i++)
	{	img = document.images[i];
		onclick = img.getAttribute("onclick");
		if (onclick != undefined && onclick.indexOf("desc") != -1)
			AddInvCheck(img);
	}
}


// -------------------------------------
// BEERPONG: Auto-choose pirate insults.
// -------------------------------------
function at_beerpong()
{
	var val = 0, html = $('img[src*=beerpong]').parent().parent().html();
	if(html)
	{	if(html.indexOf('ll flay') != -1) val = 1;
		else if(html.indexOf('craven') != -1) val = 2;
		else if(html.indexOf('pestilent') != -1) val = 3;
		else if(html.indexOf('run red') != -1) val = 4;
		else if(html.indexOf('ned goat') != -1) val = 5;
		else if(html.indexOf('tle girl') != -1) val = 6;
		else if(html.indexOf('some worm') != -1) val = 7;
		else if(html.indexOf('ngle man') != -1) val = 8;

		var sel = $('select[name=response]');
		sel.children().each(function()
		{	if($(this).val() > 8) $(this).attr('disabled','disabled');
		});
		if(val > 0)
		{	var opt = sel.find('option[value='+val+']');
			if(opt.length > 0) opt.attr('selected','selected');
			else val = 0;
		}
		if(val == 0) sel.prepend($(document.createElement('option'))
			.attr('selected','selected').attr('value','0')
			.html(' '));
}	}

// -----------------------------------------------
// INVENTORY: Add shortcuts when equipping outfits
// -----------------------------------------------
function at_inventory()
{
	var firstTable = document.getElementsByTagName('table')[0];

	var gearpage = 0; // Man, this is annoying.
	var searchString = document.location.search;
	if (searchString.indexOf("which=2") != -1) gearpage = 1;

// Eat/drink page: add "eat another"/"drink another" link/checkboxes after eating/drinking something.
// 13Jan10 Hellion:
// with the advent of "(eat/drink) some" links in-game, this functionality is relatively superfluous.
//	else if (searchString.indexOf("which=1") != -1)
//	{	var lastfood = GetData('lastfood');
//		var lastbooze = GetData('lastbooze');
//		if(lastfood)
//		{	SetData('lastfood', 0);
//			if($('a[href="'+lastfood.split('m/')[1]+'"]').length>0)
//			$('table tr:eq(1) td:first').append('<center><a href="'+ lastfood +
//				'" target="mainpane" class="tiny">'+
//				'[eat another]</a><br /><br /></center>');
//		} else if(lastbooze)
//		{	SetData('lastbooze', 0);
//			if($('a[href="'+lastbooze.split('m/')[1]+'"]').length>0)
//			$('table tr:eq(1) td:first').append('<center><input ' +
//				'id="boozeconfirm" type="checkbox" style="position:relative;' +
//				'top:4px;" /> <a href="' + lastbooze + '" target="mainpane" ' +
//				'class="tiny" onclick="return document.getElementById' +
//				'(\'boozeconfirm\').checked;">[drink another]' +
//				'</a><br /><br /></center>');
//		}
//
//		if(GetPref('eatagain'))
//		{	$('a[href*=inv_ea]') //.html('[om nom nom]')
//			.click(function()
//			{	SetData('lastfood', this.href); 	});
//			$('a[href*=inv_boo]') //.html('[slurrrrp]')
//				.click(function()
//			{	SetData('lastbooze', this.href); });
//		}
//	}

	// Misc: Blackbird
	else if (searchString.indexOf("action=message") != -1)
	{	var fimg = $('img:first');
		var src = fimg.attr('src');
		if(src.indexOf('blackbird1') != -1)
		{	var fly = document.createElement('a');
			fly.innerHTML = '[fly, fly, fly]';
			fly.setAttribute('href', 'javascript:void(0);');
			$(fly).click(BlackBirdStuff);
			fimg.after(fly)
				.after(document.createElement('br'));
		}
		else if(src.indexOf('scroll1.gif') != -1)
		{	var clov = $('b:lt(5):contains(clover)');
			if(clov.length > 0)
			{	var quant = clov.text().match(/^[0-9]*/);
				if(!quant) quant = 1;
				clov.append(AppendLink('[disassemble]','multiuse.php?pwd='+
				pwd+'&action=useitem&quantity='+quant+'&whichitem=24'));
		}	}
	}

	// Equipment page only
	if (gearpage == 1)
	{
		var backup = GetPref('backup');
		var quickequip = GetPref("quickequip");
		var lnks = document.links;
		var unlink, famLock;
		var didQElink = false;
		var selecty = document.getElementsByTagName('select')[0];

		if (backup != '')
		{	for (var i=0, len=lnks.length; i<len; i++)
			{	var lnk = lnks[i];

				if (/familiar\.php/.test(lnk.href))
				{	famLock = lnk; continue; }

				if (lnk.text == "[unequip all]"
				 || lnk.text == "Manage your Custom Outfits")
				{
					if(!didQElink)
					{	var qelnk = document.createElement('a');
						qelnk.setAttribute('href','javascript:void(0);');
						qelnk.setAttribute('style', 'color:white;' +
							'font-size:10px;');
						qelnk.innerHTML = (quickequip == "1" ?
							"Dis" : "En") + "able Quick-Equip";
						qelnk.addEventListener('click', function(event)
						{	SetPref('quickequip',
								this.innerHTML.charAt(0) == 'E' ? 1 : 0);
							document.location = 'inventory.php?which=2';
						}, false);
						var qediv = document.createElement('div');
						qediv.setAttribute('style',
							'float:right;padding:0 7px;margin-top:3px;');
						qediv.appendChild(qelnk);
						$(lnk).parents('center').parents('tr').prev()
						.children('td:first')
						.prepend('<div style="float:left;width:110px;">'+
							'&nbsp;</div>')
						.prepend(qediv);
						didQElink = true;
					}

					var yetAnotherVariable = 1;
					if (lnk.text != "Manage your Custom Outfits")
						unlink = lnk;
					else
					{	yetAnotherVariable = 0;
						unlink = selecty.parentNode.previousSibling;
						unlink.firstChild.appendChild(
							document.createElement('tr'));
						unlink.firstChild.lastChild.appendChild(
							document.createElement('td'));
						unlink = unlink.firstChild.lastChild.lastChild;
						unlink.setAttribute('align','center');
						unlink.setAttribute('colspan','3');
						unlink.appendChild(document.createElement('font'));
						unlink = unlink.firstChild;
						unlink.setAttribute('size','1');
						unlink.appendChild(document.createTextNode(' '));
						unlink = unlink.lastChild;
					}
					if (yetAnotherVariable == 1)
					{	var newlink = document.createElement('a');
						newlink.innerHTML = "[backup]";
						newlink.href = "#";
						//newlink.addEventListener('contextmenu',function(event)
						//{	alert('pow!');}, false);
						newlink.addEventListener('click',function(event)
						{	this.innerHTML = "[backing up...]";
							GM_get(server + '/inv_equip.php?action=customoutfit&which=2&outfitname=' + GetPref('backup'),
							function(response)
							{	for (var i=0, len=document.links.length; i<len; i++)
								{	if (document.links[i].text.indexOf("...") != -1)
									{	if (response.indexOf("custom outfits") == -1)
											document.links[i].innerHTML = "[done]";
										else document.links[i].innerHTML = "[too many outfits]";
										break;
							}	}	}); event.stopPropagation(); event.preventDefault();
						}, false);
						unlink.parentNode.insertBefore(newlink,unlink);
						unlink.parentNode.insertBefore(document.createTextNode(" - "),unlink);
					}

					// Save contents of outfit menu
					var nunewlink; var opty;
					for (i=1, len=selecty.options.length; i<len; i++)
					{	opty = selecty.options[i];
						if (opty.text == backup)
						{	nunewlink = document.createElement('a');
							nunewlink.innerHTML = "[revert to " + backup.toLowerCase() + "]";
							nunewlink.href = "inv_equip.php?action=outfit&which=2&whichoutfit=" + opty.value;
							nunewlink.addEventListener('contextmenu',function(event)
							{	alert('powee!');}, false);
					}	}

					if (nunewlink)
						unlink.parentNode.insertBefore(nunewlink,unlink);
					if (yetAnotherVariable == 1) unlink.parentNode.insertBefore(
						document.createTextNode(" - "),unlink);
					break;
				}
			}	
		}

		if(quickequip > 0)
		{
			var shelfToNum =
			{"Hats:":0,"Shirts:":1,"Melee Weapons:":2,"Ranged Weapons:":2,"Mysticality Weapons:":2,
			"Weapons:":2,"Off-Hand Items:":3,"Pants:":4,"Accessories:":5,"Familiar Equipment:":8};

			numToEquipType =
			{0:"Hat:",1:"Shirt:",2:"Weapon:",3:"Off-Hand:",4:"Pants:",
			5:"Accessory 1:",6:"Accessory 2:",7:"Accessory 3:",8:"Familiar:"};

			equipTypeToNum =
			{"Hat:":0,"Shirt:":1,"Weapon:":2,"Off-Hand:":3,"Pants:":4,
			"Accessory_1:":5,"Accessory_2:":6,"Accessory_3:":7,"Familiar:":8};

			shelfNumToLink =
			{0:"Hats",1:"Shirts",2:"Weapons",3:"Off-Hand",4:"Pants",
			5:"Accessories",6:"Accessories",7:"Accessories",8:"Familiar"};

			var equips = []; var pics = []; var selects = []; var curgear = [];
			var curgearnum = []; var hands = 1;
			GetItemDB();

			// First pass: Get currently equipped items
			var gearList = selecty.parentNode.previousSibling.firstChild;
			len = gearList.childNodes.length;
			for (var i=0, len=gearList.childNodes.length; i<len; i++)
			{	var tr = gearList.childNodes[i];

				if (tr.childNodes.length < 2) break;
				//if (tr.childNodes[0].innerHTML.length == 0) continue;

				var shelfText = tr.childNodes[0].textContent.replace(/[\s]/, '_');

				var shelfNum = equipTypeToNum[shelfText];
				//var shelfNum = i;

				// Store item number and name of currently equipped item.
				if (tr.childNodes[1].firstChild
				&& tr.childNodes[1].firstChild.tagName == 'IMG')
				{	if (shelfNum == 2 && tr.childNodes[2]
						.textContent.indexOf("1h") == -1) hands = 2;
					equips[shelfNum] = tr.childNodes[2];

					var pic = tr.childNodes[1].firstChild;
					if (pic != undefined)
					{	pics[shelfNum] = pic.parentNode.innerHTML;
						var piclic = pic.getAttribute('onclick');
						if (piclic != undefined)
						{	var itm = DescToItem(piclic);
							if(itm)
							{	curgear[shelfNum] = itm[1];		// was ['name']
								curgearnum[shelfNum] = itm[0];	// was ['itemid']
				}	}	}	}

				// Item slot is empty
				else
				{	equips[shelfNum] = (tr.childNodes.length > 2 ?
						tr.childNodes[2] : tr.childNodes[1]);
				}

				// Create select menus
				var newsel = document.createElement('select');
				newsel.setAttribute('style',"width:250px;");
				newsel.setAttribute('name', shelfNum);
				if (shelfNum == 3)
				{	if(hands == 2) newsel.setAttribute('disabled','disabled');
				}
				if (curgearnum[shelfNum] > 0)
				{	newsel.appendChild(document.createElement('option'));
				}
				selects[shelfNum] = newsel;
			}

			// Second pass: Create new table and rows.
			var nuTabl = $(document.createElement('table'));
			var len = 9;
			for (var i=0; i<len; i++)
			{
				var extra = (i==8 && famLock ? '<a href="' + famLock.href + '">' +
				'<img class="hand" src="'+ famLock.firstChild.src +
				'" style="height:20px;width:20px;margin-right:15px;" /></a>' : '');

				nuTabl.append('<tr align="right"><td height="30">' + extra +
				'<a class="nounder" href="#' + shelfNumToLink[i] + '">' +
				numToEquipType[i] + '</a></td><td>' +
				(pics[i] != undefined ? pics[i] : '&nbsp;') +
				'</td><td> </td><td align="left"> </td></tr>');

				if(curgear[i] == undefined)
				{	curgear[i] = "";
					curgearnum[i] = 0;
				}

				// Create selects for blank rows
				if(selects[i] == undefined)
				{	var newsel = document.createElement('select');
					newsel.setAttribute('style',"width:250px;");
					newsel.setAttribute('name', i);
					//if (curgearnum[i] != 0)
					newsel.appendChild(document.createElement('option'));
					selects[i] = newsel;
					equips[i] = document.createElement('td');
				}
			}

			// Attach new gear table and links to the DOM
			$(gearList.parentNode)
				.before(nuTabl.get(0))
				.before(unlink.parentNode)
				.before(document.createElement('br'))
				.attr('style','display:none;');

			// Iterate through links
			len = lnks.length;
			var lensub = len-1;
			var theSel, itemText, shelf;
			for (var i=0; i<len; i++)
			{	var lnk = lnks[i];

				// Switch to new shelf, and add anchor
				if (lnk.href.substr(0,4) == 'java')
				{	shelf = shelfToNum[lnk.text];
					continue;
				}

				// Add equippable item to drop-down of current shelf.
				else if (lnk.text == "[equip]" || lnk.text == "[offhand]")
				{	itemText = lnk.parentNode.parentNode.firstChild.innerHTML;

					// Three iterations for accessories.
					var limit = 1; if (shelf == 5) limit = 3;
					for (var j=0; j<limit; j++)
					{	var zshelf; if (lnk.text == "[offhand]") zshelf = 3;
						else zshelf = shelf+j;
						theSel = selects[zshelf];
						if (theSel == undefined) continue;

						// Create the select menu option
						var opt = document.createElement("option");
						opt.setAttribute("value",lnk.href.split("item=")[1]);
						if(lnk.text == "[offhand]")
						{	opt.setAttribute('dualwield', 1);
						}
						opt.innerHTML = itemText;

						// Add the currently worn item to the menu, if necessary
						if (!theSel.getAttribute("gearfound"))
						{	var curText = curgear[zshelf].toLowerCase();
							var tstText = itemText.toLowerCase();
							if (tstText == curText) selects[zshelf].setAttribute('gearfound','gearfound');
							else if (tstText > curText)
							/*|| lnks[i+1] == undefined || lnks[i+1].href.indexOf(":t") != -1)*/
							{	var opt2 = document.createElement("option");
								opt2.setAttribute("value",curgearnum[zshelf]);
								opt2.innerHTML = curgear[zshelf];
								theSel.appendChild(opt2);
								theSel.setAttribute('gearfound','gearfound');
							}
						}
						theSel.appendChild(opt);
					}
				}
			}

			gearList = nuTabl.get(0).firstChild;

			var unq = ["hat","shirt","weapon","offhand","pants",
						"acc1","acc2","acc3","familiarequip"];

			// Add the select menus to the DOM and select the currently worn item
			for (var i=0; i<9; i++)
			{
				var row = gearList.childNodes[i];
				var eqnum = i;
				var tempsel = selects[i]; var nuus = [];
				var action = "equip";

				// Add currently equipped item if not found in equip links
				if(!tempsel.getAttribute('gearfound') && curgearnum[i] > 0)
				{	var newopt = document.createElement('option');
					newopt.innerHTML = curgear[i];
					newopt.setAttribute("value", curgearnum[i]);
					tempsel.appendChild(newopt);
					//tempsel.setAttribute('gearfound');
				}

				for (var j=0, len2=tempsel.childNodes.length; j<len2; j++)
				{	if (tempsel.childNodes[j].value == curgearnum[i])
					{	tempsel.selectedIndex = j;	break;
				}	}

				// Attach event handler that does the work
				tempsel.addEventListener('change',function(event)
				{	if (this.value == 0) return;
					var loading =
	'data:image/gif;base64,R0lGODlhEgASAJECAMDAwNvb2%2F%2F%2F%2FwAAACH%2FC05FVFNDQVBFMi4wAwEAAAAh%2BQQFCgACACwAAAAAEgASAAACMpSPqQmw39o7IYjo6qpacpt8iKhoITiiG0qWnNGepjCv7u3WMfxqO0%2FrqVa1CdCIRBQAACH5BAUKAAIALAcAAQAIAAYAAAIOVCKZd2osAFhISmcnngUAIfkEBQoAAgAsCwADAAYACAAAAg5UInmnm4ZeAuBROq%2BtBQAh%2BQQFCgACACwLAAcABgAIAAACD5QTJojH2gQAak5jKdaiAAAh%2BQQFCgACACwHAAsACAAGAAACDpQdcZgKIFp4Lzq6RF0FACH5BAUKAAIALAMACwAIAAYAAAIOFCCZd2osQlhISmcnngUAIfkEBQoAAgAsAQAHAAYACAAAAg4UIHmnm4ZeCuFROq%2BtBQAh%2BQQFCgACACwBAAMABgAIAAACD5QBJojH2kQIak5jKdaiAAA7';

					this.setAttribute('previtem',this.value);
					var imgtd = this.parentNode.previousSibling;

					$(imgtd.firstChild).attr('style','display:none;')
					.before('<img src="'+loading+'" width="30" height="30" />');

					if(this.childNodes[this.selectedIndex]
						.getAttribute('dualwield')) action = "dualwield";

					if (imgtd.childNodes.length > 0)
						this.setAttribute('previmg',imgtd.firstChild.src);
					else this.setAttribute('previmg',0);

					var ztype = parseInt(this.getAttribute('name'));
					var url = /*'http://'+*/server+"/inv_equip.php?pwd="+
					pwd+"&which=2&action="+action+"&whichitem="+this.value;
					if (ztype == 5) url += "&slot=1";
					else if (ztype == 6) url += "&slot=2";
					else if (ztype == 7) url += "&slot=3";

				// I forget why I had to do this, but I'm sure there was a reason.
					switch(ztype)
					{	case 0: GM_get(url, function(t){EquipUpdate(t,0);}); break;
						case 1: GM_get(url, function(t){EquipUpdate(t,1);}); break;
						case 2: GM_get(url, function(t){EquipUpdate(t,2);}); break;
						case 3: GM_get(url, function(t){EquipUpdate(t,3);}); break;
						case 4: GM_get(url, function(t){EquipUpdate(t,4);}); break;
						case 5: GM_get(url, function(t){EquipUpdate(t,5);}); break;
						case 6: GM_get(url, function(t){EquipUpdate(t,6);}); break;
						case 7: GM_get(url, function(t){EquipUpdate(t,7);}); break;
						case 8: GM_get(url, function(t){EquipUpdate(t,8);}); break;
					}
				}, false);

				gearList.childNodes[i].childNodes[2].appendChild(tempsel);

				// Add power and unequip links
				var pow = '';
				var descTD = $(row.childNodes[3]);
				pow = equips[i].innerHTML.match(/\(Pow.+\)/);
				if(pow != null) descTD.append('<font size="1"> '+ pow+ '</font> ');
				else descTD.append(' ');

				if(row.childNodes[1].firstChild.tagName == 'IMG')
				{	var un = document.createElement('a');
					un.innerHTML = '<font size="1">[unequip]</font>';
					un.setAttribute('href', 'inv_equip.php?pwd='+pwd+
					'&which=2&action=unequip&type='+unq[i]);
					un.addEventListener('click', UnequipUpdate, false);
					descTD.append(un);
				}
			}
		} // quickequip
	} // equippage

	if (GetPref('shortlinks') > 1 && firstTable.rows[0].textContent == "Results:")
	{	var resultsText = firstTable.rows[1].textContent, bText;
//		GM_log("resultsText:"+resultsText);
//		GM_log("referrer:"+document.referrer);
// this is where we go back to a useful location if we've done/used something elsewhere that caused the inventory page to load.
		if (resultsText.indexOf("tumbling rocks") != -1 &&
			document.referrer.indexOf('bathole.php') != -1)	// used a sonar at the bathole
			parent.frames[2].location =
				'http://' + server + '/bathole.php';
		else if (resultsText.indexOf("cheap ratchet") != -1 &&
			document.referrer.indexOf('pyramid.php') != -1)	// used a tomb ratchet at the pyramid
			parent.frames[2].location =
				'http://' + server + '/pyramid.php';
		else if (resultsText.indexOf("duck talk") != -1)	// used the giant castle map successfully
		{	bText = document.getElementsByTagName('b')[1];
			if (bText.textContent == "quantum egg")
			{	bText.parentNode.appendChild(AppendLink('[rowboat]',
				'craft.php?mode=combine&action=craft&a=652&b=609&pwd=' + pwd + '&quantity=1'));
				GoGoGadgetPlunger();
			}	
		}
		else if (resultsText.indexOf("All items unequipped") != -1 &&
			document.referrer.indexOf('lair6.php') != -1)	// clicked the 'get nekkid' link at the gash
		{	parent.frames[2].location = 
				'http://'+ server + '/lair6.php';
		} 
		else if (resultsText.indexOf("You discard your Instant Karma") != -1 && 
			document.referrer.indexOf('lair6.php') != -1)	// clicked the 'discard karma' link at the gash
		{	parent.frames[2].location = 
				'http://' + server + '/lair6.php';
		}
// and this is where we add all the nifty little links after equipping something.
		else if (resultsText.indexOf("You equip an item") != -1)
		{	bText = document.getElementsByTagName('b')[1];
			//var item = resultsText.substring(14);
			var item = bText.textContent;
			GM_log("item="+item);
			if (item == "continuum transfunctioner")
				bText.parentNode.appendChild(AppendLink('[8-bit]', 'adventure.php?snarfblat=73'));
			else if (item == "huge mirror shard")
				bText.parentNode.appendChild(AppendLink('[chamber]', 'lair6.php?place=1'));
			else if (item == "makeshift SCUBA gear")
				bText.parentNode.appendChild(AppendLink('[odor]', 'lair2.php?action=odor'));
			else if (item == "snorkel")
				bText.parentNode.appendChild(AppendLink('[map]', 'inv_use.php?pwd='+
				pwd + '&which=3&whichitem=26'));
			else if (item == "pool cue")
				bText.parentNode.appendChild(AppendLink('[chalk]', 'inv_use.php?pwd='+
				pwd + '&which=3&whichitem=1794'));
			else if (item == "Talisman o' Nam")
               bText.parentNode.appendChild(AppendLink('[palindome]', 'plains.php'));
			else if (item == "worm-riding hooks")
               bText.parentNode.appendChild(AppendLink('[drum]', 'inv_use.php?pwd='+
               pwd + '&which=2&whichitem=2328'));
			else if (item.indexOf("spectacles") != -1 && document.referrer.indexOf('manor3') != -1)
				top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/manor3.php';
		}
		else if (resultsText.indexOf("Outfit:") != -1)
		{
			var outfit = resultsText.split(": ")[1];
			var equipText = firstTable.rows[1].cells[0]
				.firstChild.firstChild.firstChild.firstChild;
			equipText.setAttribute('valign', 'baseline');

			if (outfit.indexOf("Harem Girl") != -1)
			{	equipText.appendChild(AppendLink('[perfume]',
					'inv_use.php?pwd=' + pwd + '&which=3&whichitem=307'));
				equipText.appendChild(AppendLink('[knob]', 'knob.php'));
			}
			else if (outfit.indexOf("Swashbuckling") != -1)
			{	if (document.referrer.indexOf('council') == -1)
					equipText.appendChild(AppendLink('[council]', 'council.php'));
				equipText.appendChild(AppendLink('[island]', 'island.php'));
			}
			else if (outfit.indexOf("Filthy Hippy") != -1)
			{	if (document.referrer.indexOf('store.php') != -1)
					parent.frames[2].location = 'http://' + server + '/store.php?whichstore=h';
				else equipText.appendChild(AppendLink('[fruit]', 'store.php?whichstore=h'));
			}
			else if (outfit.indexOf("Mining Gear") != -1)
				equipText.appendChild(AppendLink('[mine]', 'mining.php?mine=1'));
			else if (outfit.indexOf("Elite Guard") != -1)
			{	if (document.referrer.indexOf('store.php') != -1)
					parent.frames[2].location = 'http://' + server + '/store.php?whichstore=g';
				else equipText.appendChild(AppendLink('[lab]', 'store.php?whichstore=g'));
			}
			else if (outfit.indexOf("Bugbear") != -1)
			{	if (document.referrer.indexOf('store.php') != -1)
					parent.frames[2].location = 'http://' + server + '/store.php?whichstore=b';
				else equipText.appendChild(AppendLink('[bakery]', 'store.php?whichstore=b'));
			}
			else if (outfit.indexOf("eXtreme") != -1)
				equipText.appendChild(AppendLink('[trapz0r]', 'trapper.php'));
			else if (outfit.indexOf("Cloaca-Cola") != -1)
				equipText.appendChild(AppendLink('[battlefield]', 'adventure.php?snarfblat=85'));
			else if (outfit.indexOf("Dyspepsi-Cola") != -1)
				equipText.appendChild(AppendLink('[battlefield]', 'adventure.php?snarfblat=85'));
			else if (outfit.indexOf("Frat Warrior") != -1 || outfit.indexOf("War Hippy") != -1)
				equipText.appendChild(AppendLink('[island]', 'island.php'));
		}	
	}
}

// -----------------------------------
// GALAKTIK: Add use boxes when buying
// -----------------------------------
function at_galaktik()
{
	var row = $('table:first tr:eq(1):contains("You acquire")'), txt;
	if(row.length == 1)
	{	var num = 1;
		txt = row.text();
		if (txt.indexOf("an item:") == -1)
			num = $('b:eq(1)').text().split(" ")[0];
		var docG = DescToItem($('img:first')
			.get(0).getAttribute('onclick'))[0];	// was ['itemid']

		if (GetPref('docuse') == 1 && docG < 233)	// 231=unguent, 232=ointment.  we can auto-use those.
		{	var sanitycheck = FindMaxQuantity(docG, num, 0, 0) + 1;
			if (num > sanitycheck) num = sanitycheck;
			parent.frames[2].location = 'http://' + server +
			'/multiuse.php?action=useitem&quantity=' + num +
			'&pwd=' + pwd + '&whichitem=' + docG;
		} else
		{	AppendUseBox(docG, 0, 1, row.find('td center').get(0));
			if (num > 1) NumberLink($('b:eq(1)').get(0));
		}
	}

	var howMany = $('input[name=howmany]');
	var check = $(document.createElement('input'))
		.attr("type","checkbox")
		.attr("name","usecheckbox")
		.attr("style","height:12px;width:12px;");
	if (GetPref('docuse') == 1) check.attr("checked",true);
	check.change(function()
	{	var box = $('input[name=usecheckbox]');
		if (box.attr('checked')) SetPref('docuse',1);
		else SetPref('docuse',0);
	});
	var checkSpan = $(document.createElement('span'))
		.attr("class","small")
		.append(document.createElement('br'))
		.append(document.createElement('br'))
		.append(check)
		.append(document.createTextNode("Auto-Use Unguents And Ointments"));
	howMany.after(checkSpan);
}

// -------------------------------------------------------------
// BIGISLAND: add inventory check to Frat/Hippy Trade-In stores.
// -------------------------------------------------------------
function at_bigisland()
{
	$('img').each(function()
	{	var onclick = this.getAttribute('onclick');
		if (onclick != undefined && onclick.indexOf("desc") != -1)
			AddInvCheck(this);
	});
	// if we're showing the junkyard, add onclick events to track which junkyard zone we go into.
	if ((document.location.search == "?place=junkyard") || (document.location.search.indexOf("action=junkman") != -1)) {
		$('a:lt(4)').click(function() {
		var a = $(this);
		SetData("square",a.attr('href'));
		});
	}
}

// ---------------------------------------------
// STORE: Add use boxes and links as appropriate
// ---------------------------------------------
function at_store()
{	var firstTable = $('table:first tbody');		// we're interested in this when it's the "Results:" box from buying something.
	var whichstore; var noform = 1;

	var insput = $('input[name=whichstore]');
	if (insput.length > 0)
	{	whichstore = insput.attr('value'); noform = 0;
	} else whichstore = document.location.search
		.match(/whichstore\=([a-z0-9])/)[1];

	// Refresh hash
	var inphash = $("input[name=phash]");
	if(inphash.length>0) SetPwd(inphash.val());

	// Quantity checking
	$('img').each(function()
	{	var onclick = this.getAttribute('onclick');
		if (onclick != undefined && onclick.indexOf("desc") != -1)
			AddInvCheck(this);
	});

	// You can thank Mr. Mag for this one...
	// right-click on the image of the shopkeeper to put on your travoltan trousers without leaving the store.
	if (whichstore != 'g') {	// can't switch pants in the lab store, and this throws an error if you're in the wrong outfit anyway.
		$("img[src*=otherimages]:first").attr('id','proprietor').get(0)
		.addEventListener('contextmenu', function(evt)
		{	GM_get(server+'/inv_equip.php?pwd='+pwd+
				'&which=2&action=equip&whichitem=1792',
			function(txt)
			{	var pimg = document.getElementById('proprietor');
				pimg.removeAttribute('id');
				pimg.parentNode.nextSibling.innerHTML +=
				'<br /><div class="tiny">' +
				(txt.indexOf('You equip') != -1 ?
				'Travoltan Trousers Equipped' :
				'Travoltan Trousers Could Not Be Equipped') + '</span>';
			}); evt.stopPropagation(); evt.preventDefault();
		}, true);
	}

	if (GetPref('shortlinks') > 1 && firstTable != undefined &&
		firstTable.children('tr:first').text() == "Market Results:" &&
		firstTable.children('tr:eq(1)').text().indexOf("You acquire") != -1)
	{	var descId = $('img:first').get(0).getAttribute('onclick');

		var acquireString = firstTable.children('tr:eq(1)').text();
		var acquireText = firstTable.find('tr:eq(1) td:first *:first');
		var bText = $('b:eq(1)').attr('valign','baseline');

		switch(whichstore)
		{	case 'b':		// everything from the bugbear bakery is cookable.
				bText.parent().append(AppendLink('[cook]', '/craft.php?mode=cook')); break;
			case 'j':		// everything from the jeweler is pliable
				bText.parent().append(AppendLink('[ply]', 'craft.php?mode=jewelry'));
				break;
			case 's':		// everything from the meatsmith is smithable.
				if (document.referrer.indexOf('craft') != -1)
					parent.frames[2].location = 'http://' + server + '/craft.php?mode=smith';
				bText.parent().append(AppendLink('[smith]', 'craft.php?mode=smith'));
				break;
			case 'h':		// everything from the hippy is cook/mix/stillable.
				bText.parent()
					.append(AppendLink('[cook]', 'craft.php?mode=cook'))
					.append(AppendLink('[mix]', 'craft.php?mode=cocktail'))
					.append(AppendLink('[still]', 'guild.php?place=still'));
				break;
			case 'r':		// pirate store: untinker the dictionary.
				if (acquireString.indexOf('dictionary') != -1)
					bText.parent().append(AppendLink('[untinker]', 'town_right.php?place=untinker'));
				break;
		}

		if (descId != undefined)
		{	var whut = AddLinks(descId, bText.parent().parent().get(0), acquireText, thePath);
			if ((whut == 'skill' || whut == 'use') && firstTable.children('tr:eq(1)').text().indexOf("an item:") == -1)
				NumberLink(bText.get(0));
		}
	}

	var swap;
	if (GetPref('shortlinks') > 1)
	{
		if (whichstore == 'g') // Stupid Lab Key *sigh*
		{	
			if (document.body.textContent == "Uh Oh!You don't belong in this store.")
			{	
				GM_get(server+'/knob2.php',function(knob2)
				{	
					if (knob2.indexOf('locked') != -1) document.firstChild.innerHTML += knob2;
					else {
						var style = $(document.createElement('style'))
							.attr('type', 'text/css')
							.html("body {font-family: Arial, Helvetica, sans-serif; background-color: white; color: black;} " +
							"td {font-family: Arial, Helvetica, sans-serif;} input.button {border: 2px black solid; " +
							"font-family: Arial, Helvetica, sans-serif; font-size: 10pt; font-weight: bold; background-color: #FFFFFF;}");
						//document.firstChild.firstChild.appendChild(style);
						$('head').append(style);

						var tabl = $(document.createElement('table'))
							.attr('width','95%')
							.attr('style','font-family: Arial, Helvetica, sans-serif')
							.attr('cellspacing','0')
							.attr('cellpadding','0')
							.append(document.createElement('tbody'));
						tabl.children('tbody')
							.append(document.createElement('tr'))
							.append(document.createElement('tr'));
						var td = $(document.createElement('td'))
							.attr('bgcolor','blue')
							.attr('align','center')
							.attr('style','color: white;')
							.html('<b>Knob Goblin Laboratory</b>');
						tabl.find('tbody tr:first').append(td);
						td = $(document.createElement('td'))
							.attr('style','border: 1px solid blue; padding: 5px;')
							.attr('align','center')
							.append('<p><img src="http://images.kingdomofloathing.com'
							+ '/otherimages/shopgoblin.gif" align="middle">'
							+ 'How did <i>you</i> get here? This store is '
							+ 'for guards only!<br>');
						td.children('p').append(
							AppendOutfitSwap(5, "Get In Gear, Soldier!",0));
						tabl.find('tbody tr:eq(1)').append(td);
						var centre = $(document.createElement('center'))
							.append(tabl);
						$('body').append(centre);
					}
				});
			}
			else {	
				$('p:first').append(
					AppendOutfitSwap(0, "Return To Civilian Life", 0));
			}	
		}
		else if (whichstore == 'h')
		{	if (noform == 1)
				swap = AppendOutfitSwap(2, "Like, Get Groovy, Man", 0);
			else swap = AppendOutfitSwap(0, "Whoa, Clear Your Head, Man", 0);
			$('p:first').append(swap);
		} else if (whichstore == 'b')
		{	if (noform == 1) swap = AppendOutfitSwap(1,
				"Wave Your Hand And Say \"But I Am A Bugbear.\"", 0);
			else swap = AppendOutfitSwap(0,
				"Sneak Away Before The Bugbear Catches On", 0);
			$('p:first').append(swap);
		}
	}
}

// ---------------------------------
// CASINO: Add link for buying pass.
// ---------------------------------
function at_casino()
{	if (GetPref('shortlinks') > 1)
	{	if($('table:first tr:eq(1)').text().indexOf("Casino Pass") != -1)
			$('p:first').html(AppendBuyBox(40, 'm', 'Buy Casino Pass', 1));
	}	
}

// -------------------------------------
// CRAFT: Buttons for buying ovens, etc.
// -------------------------------------
function at_craft()
{
	var mode = document.location.search.match(/mode=[a-z]+/), mlink, store;
	if(mode) mode = mode.toString().split('=')[1];
	switch(mode)
	{
		case 'combine':
			break;

		case 'cook':
			mlink = $('a[href$="store.php?whichstore=m"]');
			if (GetPref('shortlinks') > 1 && mlink.length > 0)
			{	mlink.parent().before('<span id="buyspan"></span>');
				GM_get(server + '/heydeze.php', function(txt)
				{	if(txt != '') store = 'y';
					else store = 'm';
					$('#buyspan').before(
						AppendBuyBox(157, store, 'Buy Oven', 1));
				});
			} break;

		case 'cocktail':
			mlink = $('a[href$="store.php?whichstore=m"]');
			if (GetPref('shortlinks') > 1 && mlink.length > 0)
			{	mlink.parent().before('<span id="buyspan"></span>');
				GM_get(server + '/heydeze.php', function(txt)
				{	if(txt != '') store = 'y';
					else store = 'm';
					$('#buyspan').before(
						AppendBuyBox(236, store, 'Buy Cocktailcrafting Kit', 1));
				});
			} break;

		case 'smith':
			mlink = $('a[href$="store.php?whichstore=s"]');
			if (GetPref('shortlinks') > 1 && mlink.length > 0)
			{	mlink.parent().before('<span id="buyspan"></span>');
				GM_get(server + '/heydeze.php', function(txt)
				{	if(txt != '') store = 'y';
					else store = 's';
					$('#buyspan').before(
						AppendBuyBox(338, store, 'Buy Hammer', 1));
				});
			}

			// Needs layout fix
			var box = $('form[name=pulverize] input[name=qty]');
			if(box.length > 0)
			{	var smash = $('select[name=smashitem]');
				smash.attr('style', 'vertical-align:top;');
				MakeMaxButton(box.get(0), function(event)
				{	box.val(ParseSelectQuantity(smash.get(0), " "));
				});
				var parTabl = box.parent().parent().parent().parent();
				parTabl.attr('style', parTabl.attr('style') +
					' vertical-align:middle;');
			}

			$('b').each(function()
			{	var zis = $(this);
				var txt = zis.text();
				if (txt.indexOf("powder") != -1)
				{	$zis.parent().append(AppendLink('[malus]',
						'guild.php?place=malus'));
				}
				else if (txt.indexOf("nugget") != -1)
				{	zis.parent().append(AppendLink('[malus]',
						'guild.php?place=malus'));
					if (txt.indexOf("twink") == -1)
						zis.parent().append(AppendLink('[cook]',
						'/craft.php?mode=cook'));
				}
			});
			break;
	}
}

// -------------------------------
// SEWER: Add form for buying gum.
// -------------------------------
function at_sewer()
{	var tr = $('table:first tr:first:contains(Results)');
	if (GetPref('shortlinks') > 1 &&
		tr.length > 0)
	{	if (tr.next().text().indexOf("extending") != -1)
		{	$('p:first').get(0).innerHTML +=
				'<br><br>' + AppendBuyBox(23, 'm', 'Buy Gum', 0);
		} else
		{	$('b:contains(worthless)').parent()
				.append(AppendLink('[hermit]', 'hermit.php'));
		}
	}	
}

// ------------------------------------
// HERMIT: Add form for buying permits.
// ------------------------------------
// 12Jan10 Hellion: also add right-click inventory checking.
function at_hermit()
{	
	$('img').each(function()
	{	var onclick = this.getAttribute('onclick');
		if (onclick != undefined && onclick.indexOf(":item") != -1)	// Hermit calls js:item(descid) instead of js:descitem(descid)
		{	var newclick = onclick.split(':')[0] + ":desc" + onclick.split(':')[1];
			this.setAttribute('onclick',newclick);
			AddInvCheck(this);
		}
	});
	if (GetPref('shortlinks') > 1)
	{	var p = $('p:first');
		var txt = p.text();
		if (txt.indexOf("the Toot Oriole flies down") != -1)			// no permit
			p.append('<br><br>' + AppendBuyBox(42, 'm', 'Buy Permits', 0));
		else if (txt.indexOf("disappointed") != -1)						// no trinkets
			p.append('<br><br><center><a href="sewer.php">Visit Sewer</a></center>');

		var tr = $('table:first tr:contains(Results)');
		if (tr.next().text().indexOf("You acquire") != -1)
		{	var descId = $('img:first').get(0).getAttribute('onclick');
			var bText = $('b:eq(1)').attr('valign','baseline');
			if (bText.text().indexOf("ten-leaf clovers") != -1)
			{	var num = parseInt(bText.text().split(" ten-leaf")[0]);
				bText.parent().append(AppendLink('[disassemble]', 'multiuse.php?pwd=' +
				pwd + '&action=useitem&quantity=' + num + '&whichitem=24'));
			}
			else AddLinks(descId, bText.parent().parent().get(0), p, thePath);
		}
	}	
}

// ------------------------------
// COMBINE: Auto-make meat paste.
// ------------------------------
function at_craft()
{	if (location.search == "") return;
	var txt = document.body.textContent;
	if (txt.indexOf("have any meat paste") != -1 && txt.indexOf("You acquire") == -1)
	{	var quant = document.location.search.substr(
			document.location.search.lastIndexOf("ty=")+3);
		SetData('urlstorage',document.location.search);
		GM_get(server+"/craft.php?mode=combine&action=makepaste&quantity="+quant,
		function(result)
		{	if (result.indexOf("enough Meat") == -1)
			{	var url = GetData('urlstorage'); SetData('urlstorage',0);
				GM_get(server+"/craft.php"+url,function(result2)
				{	document.body.innerHTML = result2;
				});
			}
		});
	}	
}

// ---------------------------------
// MOUNTAINS: Always-visible hermit.
// ---------------------------------
function at_mountains()
{	
	var img = $('img:last');
	if(img.attr('src').indexOf("mount4") != -1)
	{
		img.attr('border', 0).attr('src','http://images.kingdomofloathing.com/'+
			'otherimages/mountains/hermitage.gif');
		var a = document.createElement('a');
		$(a).attr('href','hermit.php')
			.insertBefore(img)
			.append(img);
	}
}

// ----------------------------------------------------------
// BARREL: add links to the results of your barrel droppings.
// ----------------------------------------------------------
function at_barrel()
{	$('img').each(function()
	{	var onclick = this.getAttribute("onclick");
		if (onclick == undefined) return;
		if (onclick.indexOf("desc") != -1)
		{	AddLinks(onclick, this.parentNode.parentNode, null, thePath);
	}	});
}

// -----------------------------------------------
// COUNCIL: Add shortcut links for current quests.
// -----------------------------------------------
function at_council()
{	if (GetPref('shortlinks') > 1)
	{
		$('p').each(function()
		{	var p = $(this);
			var txt = p.text();

			if (txt.indexOf("Toot") != -1)
				p.append(AppendLink('[toot]', 'mtnoob.php?action=toot'));
			else if (txt.indexOf("larva") != -1 && txt.indexOf("Thanks") == -1)
				p.append(AppendLink('[woods]', 'woods.php'));
			else if (txt.indexOf("Typical Tavern") != -1)
				p.append(AppendLink('[tavern]', 'rats.php'));
			else if (txt.indexOf("Boss Bat") != -1)
				p.append(AppendLink('[bat hole]', 'bathole.php'));
			else if (txt.indexOf("Guild") != -1)
				p.append(AppendLink('[guild]', 'guild.php'));
			else if (txt.indexOf("Goblin King") != -1 &&
				txt.indexOf("slaying") == -1)
			{	var derr = AppendLink('[disguise]', "inv_equip.php" +
					"?action=outfit&which=2&whichoutfit=4");
				p.append(derr);	// was appendChild, which GM complains about for no apparent reason.
				if (GetPref('backup') != "")
				{	$(derr).children('*:last')
						.attr('href', 'javascript:void(0);').click(function()
					//bink.addEventListener('click',function(event)
					{	GM_get(server + '/inv_equip.php' +
							'?action=customoutfit&which=2&outfitname=' +
						GetPref('backup'), function(response)
						{	parent.frames[2].location = 'http://' + server
						+  "/inv_equip.php?action=outfit&which=2&whichoutfit=4";
						}); return false;
						//event.stopPropagation(); event.preventDefault();
					});
				}
				p.append(AppendLink('[perfume]', 'inv_use.php?pwd=' +
					pwd + '&which=3&whichitem=307'));
				p.append(AppendLink('[knob]', 'knob.php'));
			}
			else if (txt.indexOf("the Outskirts") != -1)
				p.append(AppendLink('[use map+key]','inv_use.php?pwd=' + pwd + '&which=3&whichitem=2442'));
			else if (txt.indexOf("Sinister") != -1)
				p.append(AppendLink('[cave]', 'cave.php'));
			else if (txt.indexOf("Deep Fat") != -1)
				p.append(AppendLink('[copse]', 'friars.php'));
			else if (txt.indexOf("Cyrpt") != -1)
				p.append(AppendLink('[cyrpt]', 'cyrpt.php'));
			else if (txt.indexOf("L337") != -1)
				p.append(AppendLink('[trapz0r]', 'trapper.php'));
			else if (txt.indexOf("Chasm") != -1)
				p.append(AppendLink('[mountains]', 'mountains.php'));
			if (txt.indexOf("invaded!") != -1 || txt.indexOf("pirates") != -1)
			{	var derr = AppendLink('[swashbuckle]', "inv_equip.php" +
					"?action=outfit&which=2&whichoutfit=9");
				p.append(derr);
				if (GetPref('backup') != "")
				{	$(derr).children('*:last').attr('href', '#')
					.click(function(event)
					{	GM_get(server + '/inv_equip.php' +
							'?action=customoutfit&which=2&outfitname=' +
						GetPref('backup'), function(response)
						{	parent.frames[2].location = 'http://'+server+
						"/inv_equip.php?action=outfit&which=2&whichoutfit=9";
						}); return false;
						//event.stopPropagation(); event.preventDefault();
					});
				} p.append(AppendLink('[island]', 'island.php'));
			}
			else if (txt.indexOf("garbage") != -1
				&& txt.indexOf("Thanks") == -1)
			{	if (txt.indexOf("sky") != -1)
				{	p.append(AppendLink('[plant bean]', 'inv_use.php?pwd=' +
						pwd + "&which=3&whichitem=186"));
					top.frames[0].location.reload();
				} else p.append(AppendLink('[beanstalk]', 'beanstalk.php'));
			}
			else if (txt.indexOf("her Lair") != -1)
				p.append(AppendLink('[lair]', 'lair.php'));
			else if (txt.indexOf("Black Forest") != -1)
				p.append(AppendLink('[forest]', 'adventure.php?snarfblat=111'));
			else if (txt.indexOf("war") != -1 && txt.indexOf("Island") != -1)
				p.append(AppendLink('[island]', 'island.php'));
		});

		$('b').each(function()
		{	var b = $(this);
			var txt = b.text();

			if (txt.indexOf("leaflet") != -1)
				b.append(AppendLink('[read]', 'leaflet.php'));
			else if (txt.indexOf("Knob map") != -1) 
				b.append(AppendLink('[use map+key]','inv_use.php?pwd=' + pwd + '&which=3&whichitem=2442'));
			else if ((txt.indexOf("dragonbone") != -1) || (txt.indexOf("batskin") != -1))
			{	b.append(AppendLink('[make belt]', 'craft.php?mode=combine&action=craft&a=676&b=192&pwd=' +
					pwd + '&quantity=1'));
				GoGoGadgetPlunger();
		}	});
	}

	$('img').each(function()
	{	var onclick = this.getAttribute('onclick');
		if (onclick != undefined && onclick.indexOf("desc") != -1)
			AddLinks(onclick, this.parentNode.parentNode, null, thePath);
	});
}

// -----------------------------------------------------
// QUESTLOG: Add MORE shortcut links for current quests!
// -----------------------------------------------------
function at_questlog()
{	// If this ever breaks, the following line will probably be why:
	if (document.links[0].href.indexOf("?which=1") == -1
		&& GetPref('shortlinks') > 1)
	{
		$('b').each(function()
		{	var b = $(this);
			var txt = b.text();

			if (txt.indexOf("Toot") != -1)
				b.append(AppendLink('[toot]', 'mtnoob.php?action=toot'));
			else if (txt.indexOf("Larva") != -1 || txt.indexOf("White Citadel") != -1)
				b.append(AppendLink('[woods]', 'woods.php'));
			else if (txt.indexOf("Smell a Rat") != -1)
				b.append(AppendLink('[tavern]', 'rats.php'));
			else if (txt.indexOf("Smell a Bat") != -1)
				b.append(AppendLink('[bat hole]', 'bathole.php'));
			else if (txt.indexOf("Wouldn't Be King") != -1 && txt.indexOf("slaying") == -1)
			{	var derr = AppendLink('[disguise]', "inv_equip.php?action=outfit&which=2&whichoutfit=4");
				b.append(derr);
				if (GetPref('backup') != "")
				{
					$(derr).children('*:last')
					.attr('href', 'javascript:void(0);').click(function()
					{	GM_get(server + '/inv_equip.php?action=customoutfit&which=2&outfitname=' +
						GetPref('backup'),function(response)
						{	parent.frames[2].location = 'http://'+server +
						"/inv_equip.php?action=outfit&which=2&whichoutfit=4";
						}); return false;
						//event.stopPropagation(); event.preventDefault();
					});
				}
				b.append(AppendLink('[perfume]', 'inv_use.php?pwd=' +
					pwd + '&which=3&whichitem=307'));
				b.append(AppendLink('[knob]', 'knob.php'));
			}
			else if (txt.indexOf("By Friar") != -1)
				b.append(AppendLink('[copse]', 'friars.php'));
			else if (txt.indexOf("Cyrpt") != -1)
				b.append(AppendLink('[cyrpt]', 'cyrpt.php'));
			else if (txt.indexOf("Trapper's") != -1)
				b.append(AppendLink('[trapz0r]', 'trapper.php'));
			else if (txt.indexOf(" LOL") != -1)
			{	b.append(AppendLink('[mountains]', 'mountains.php'));
				var derr = AppendLink('[swashbuckle]', "inv_equip.php?action=outfit&which=2&whichoutfit=9");
				b.append(derr);
				if (GetPref('backup') != "")
				{	$(derr).children('*:last')
					.attr('href', 'javascript:void(0);')
					.click(function(event)
					{	GM_get(server + '/inv_equip.php' +
							'?action=customoutfit&which=2&outfitname=' +
						GetPref('backup'), function(response)
						{	parent.frames[2].location = 'http://'+server +
						"/inv_equip.php?action=outfit&which=2&whichoutfit=9";
						}); return false;
						//event.stopPropagation(); event.preventDefault();
					});
				} b.append(AppendLink('[island]', 'island.php'));
			}
			else if (txt.indexOf("Garbage") != -1)
				b.append(AppendLink('[beanstalk]', 'beanstalk.php'));
			else if (txt.indexOf("Final Ultimate") != -1)
			{	b.html("The Ultimate Showdown Of Ultimate Destiny");
				b.append(AppendLink('[lair]', 'lair.php'));
			}
			else if (txt.indexOf("Made of Meat") != -1)
			{	b.append(AppendLink('[untinker]',
					'town_right.php?place=untinker'));
				b.append(AppendLink('[plains]', 'plains.php'));
			}
			else if (txt.indexOf("Driven Crazy") != -1
					|| txt.indexOf("Wizard of Ego") != -1)
				b.append(AppendLink('[plains]', 'plains.php'));
			else if (txt.indexOf("Pyramid") != -1)
				b.append(AppendLink('[beach]', 'beach.php'));
			else if (txt.indexOf("Never Odd") != -1)
			{	b.append(AppendLink("[o 'nam]", 'inv_equip.php?pwd='+pwd+
					"&which=2&slot=3&whichitem=486"));
				b.append(AppendLink('[palindome]',
					'adventure.php?snarfblat=119'));
				b.append(AppendLink('[poop deck]',
					'adventure.php?snarfblat=159'));
			} else if (txt.indexOf("Worship") != -1)
				b.append(AppendLink('[hidden city]', 'hiddencity.php'));
			else if (txt.indexOf("Manor of Spooking") != -1)
			{	b.append(AppendLink('[ballroom]',
					'adventure.php?snarfblat=109'));
				b.append(AppendLink('[wine cellars]',
					'manor3.php'));
			}
		});
	}
}

// ----------------------------------------
// CHARPANE: Find HP, MP, do effects stuff.
// ----------------------------------------
function at_charpane()
{	// var centerThing = document.getElementsByTagName('center');
	var imgs = document.images;
	if (imgs.length == 0 || imgs == null) return;
	var compactMode = imgs[0].getAttribute('height') < 60;
	var bText = document.getElementsByTagName('b');
	var curHP, maxHP, curMP, maxMP, level, str, advcount, effLink;
	var oldcount = parseInt(GetData('advcount'));
	var effectsDB = {
	'd33505':3,		// confused
	'cb5404':58,	// teleportitis
	'454d46':139,	// purple tongue
	'94e112':140,	// green tongue
	'61c56f':141,	// orange tongue
	'a4a570':142,	// red tongue
	'ec5873':143,	// blue tongue
	'cf4844':144,	// black tongue
	'173a9c':165,	// smooth
	'5e788a':166,	// musk
	'087638':189,	// hotform
	'a3c871':190,	// coldform
	'9574fa':191,	// spookyform
	'9a6852':192,	// stenchform
	'801f28':193,	// sleazeform
	'3e2eed':221,	// chalky hand
	'ec7f2f':275,	// ultrahydrated
	'79289e':292,	// Tetanus
	'15f811':295,	// socialismydia
	'c69907':297,	// temporary amnesia
	'9a12b9':301,	// Cunctatitis
	'ebaff6':357,	// Absinthe-minded
	'91635b':331	// On The Trail
	};

	SetData("charname",bText[0].textContent);

	// Compact Mode
	if (compactMode)
	{	var mp=0;
		for (var i=4, len=bText.length; i<len; i++)
		{	str = bText[i].textContent;
			var spl = str.split('/');
			if(spl.length > 1)
			{	if (mp == 0)
				{	curHP = parseInt(spl[0]);
					maxHP = parseInt(spl[1]); mp++;
					bText[i].parentNode.previousSibling
						.addEventListener('contextmenu', RightClickHP,true);
				}else
				{	curMP = parseInt(spl[0]);
					maxMP = parseInt(spl[1]);
					bText[i].parentNode.previousSibling
						.addEventListener('contextmenu',RightClickMP,true);
					break;
				}
			}
		}
		advcount = parseInt($('a:contains(Adv):first').parent().next().text());

		var lvlblock = $("center:contains('Lvl.'):first").text();
		level = lvlblock.match(/Lvl. (\d+)/)[1];

		SetData("currentHP", curHP); SetData("maxHP", maxHP);
		SetData("currentMP", curMP); SetData("maxMP", maxMP);
		SetData("level", level);
	} else { // Full Mode
		function parse_cur_and_max(names) {
			for each (var name in names) {
				var cur_max = data.shift().split('/').map(integer);
				SetData("current"+ name, cur_max[0]);
				SetData("max"    + name, cur_max[1]);
			}
		}
		var data = $.makeArray($('td[align="center"]').slice(0, 4)).map(text);
		parse_cur_and_max(["HP", "MP"]);
		data.shift(); // meat
		advcount = integer(data.shift());

		var lvlblock = $("td:contains('Level'):first").text();
		level = lvlblock.match(/Level (\d+)/)[1];
		SetData("level", level);

		// Change image link for costumes
		var img = imgs[0];
		if (GetPref('backup'))
		{	img.parentNode.parentNode.nextSibling
				.setAttribute('id','outfitbkup');
			img.addEventListener('contextmenu',function(event)
			{	GM_get(server + '/inv_equip.php?action=customoutfit&which=2&outfitname=' +
				GetPref('backup'),function(response)
				{	var msg; if (response.indexOf("custom outfits") == -1) msg = "Outfit Backed Up";
					else msg = "Too Many Outfits";
					document.getElementById('outfitbkup').innerHTML +=
					"<span class='tiny'><center>"+msg+"</center></span>";
				}); event.stopPropagation(); event.preventDefault();
			}, true);
		}

		// Add SGEEA to Effects right-click
		var bEff = $('b:gt(4):contains(Effects)');
		if(bEff.length>0) bEff.get(0).setAttribute("oncontextmenu",
			"top.mainpane.location.href='http://" + server +
			"/uneffect.php'; return false;");
	}

	// Re-hydrate (0)
	var temphydr = parseInt(GetData('hydrate'));
	if(temphydr)
	{	if(advcount > oldcount)
		{	temphydr+=(advcount-oldcount);
			SetData('hydrate', temphydr);
		}
		if(advcount < temphydr) SetData('hydrate', false);
		else if(advcount == temphydr)
		{	if(compactMode) $('a[href=adventure.php?snarfblat=123]')
				.after(':<br /><a href="adventure.php?snarfblat=122' +
				'" style="color:red;" target="mainpane">Oasis</a>');
			else $('a[href=adventure.php?snarfblat=123]')
				.after('<br /><br /><a href="adventure.php?snarfblat=122" '+
			'target="mainpane" style="color:red;">Re-Ultrahydrate</a><br />')
				.parent().parent().attr('align','center');
	}	}
	SetData('advcount', advcount);

	// Poison and other un-effecty things
	SetData("phial",0);
	for (i=0,len=imgs.length; i<len; i++)
	{	var img = imgs[i], imgClick = img.getAttribute('onclick');
		var imgSrc = img.src.substr(img.src.lastIndexOf('/')+1);
		if (imgSrc == 'mp.gif')
			img.addEventListener('contextmenu', RightClickMP, false);
		else if (imgSrc == 'hp.gif')
			img.addEventListener('contextmenu', RightClickHP, false);
		if (imgClick == null || imgClick.substr(0,4) != "eff(") continue;
		var effName = (compactMode ? img.getAttribute('title') : img.parentNode.nextSibling.firstChild.innerHTML);

		if (imgSrc == 'poison.gif')
		{	img.parentNode.parentNode.setAttribute('name','poison');
			img.addEventListener('contextmenu', function(event)
			{	document.getElementsByName('poison')[0].childNodes[1].innerHTML = "<i><span style='font-size:10px;'>Un-un-unpoisoning...</span></i>";
				GM_get(server+'/galaktik.php?howmany=1&action=buyitem&whichitem=829&pwd='+pwd,
				function(result)
				{	
					if (result.indexOf('acquire') != -1)
						GM_get(server+'/inv_use.php?which=1&whichitem=829&pwd='+pwd,function(event)
						{	top.frames[1].location.reload(); });
				}); event.stopPropagation(); event.preventDefault();
			}, false);
		}
		else if (img.getAttribute('oncontextmenu') == null)
		{	var hydr = false;

			// Effect descIDs are 32 characters?? Bah, I'm not using strings that long. Six characters will do.
			var effNum = effectsDB[imgClick.substr(5,6)];
			if (effNum == undefined) continue;
			switch (effNum)
			{	case 275: // hydrated
					var hydtxt = img.parentNode.nextSibling.textContent;
					if (/\(1\)/.test(hydtxt))			// 1 turn left?  set marker to add rehydrate link next adventure.
						SetData('hydrate', advcount-1);
					else if (/\(5\)/.test(hydtxt) || /\(20\)/.test(hydtxt))		// got 5 turns (or 20 from clover) now?  add Desert link.
					{	if(compactMode) $('a[href=adventure.php?snarfblat=122]')
						.after(':<br /><a href="adventure.php?' +
						'snarfblat=123" target="mainpane">' +
						'Desert</a>');
						else $('a[href=adventure.php?snarfblat=122]')
						.after('<br /><br /><a href="adventure.php?' +
						'snarfblat=123" target="mainpane">' +
						'The Arid, Extra-Dry Desert</a><br />')
						.parent().parent().attr('align','center');
					} break;
					
				case 221: // chalk: right-click to use more
					var func = "top.mainpane.location.href = 'http://";
					func += server + "/inv_use.php?which=3&whichitem=1794&pwd="+pwd+"'; return false;";
					img.setAttribute('oncontextmenu', func); break;
					
				case 357:	// absinthe-minded: link to wormwood; light up on 9/5/1 turns left.
					var abstxt = img.parentNode.nextSibling.textContent;
					var fontA, fontB;
					if (/\(9/.test(abstxt) || /\(5/.test(abstxt) || /\(1\)/.test(abstxt)) { fontA = '<font color="red">'; fontB = '</font>'; }
					else { fontA = ''; fontB = ''; }
					img.parentNode.nextSibling.innerHTML = '<a target=mainpane href=wormwood.php>' + fontA + '<b>' + img.parentNode.nextSibling.innerHTML + '</b>' + fontB + '</a>';
					break;
					
				case 189: case 190: case 191: case 192: case 193: SetData("phial", effNum);
				default:
					if (effName == undefined) effName = "";
					func = "if (confirm('Uneffect "+effName+"?')) top.mainpane.location.href = 'http://";
					func += server + "/uneffect.php?using=Yep.&whicheffect="+effNum+"&pwd="+pwd+"';return false;";
					img.setAttribute('oncontextmenu', func); break;
			}
		}
	}
}

// -----------------------------------------------------------------
// SKILLPAGE: Autofill the proper "maxed-out" number in the use box.
// -----------------------------------------------------------------
function at_skills()
{	var miniSkills = document.location.search.indexOf("tiny=1") != -1;
	var inputStuff = document.getElementsByTagName("input");
	var noDisable = GetPref('nodisable');
	
	// Remove stupid "The " from menu
	if (miniSkills)
	{	var sel = document.getElementsByTagName("select")[0];
		var json = "{";
		for (var i=0, len=sel.childNodes.length; i<len; i++)
		{	var s = sel.childNodes[i];
			s.setAttribute('style','max-width:180px;');
			var temp = s.value;
			// Store healing spells
			if (temp == 3012 || temp == 1010 || temp == 5011
			 || temp == 1007 || temp == 5007 || temp == 3009)
				json += ('"'+temp+'":1,');
			if (noDisable > 0 && sel.childNodes[i].getAttribute('disabled') != null)
			{	switch(parseInt(temp))
				{	case 3: case 16: case 17: case 4006: case 5014: case 3006:
						break;
					default: sel.childNodes[i].removeAttribute('disabled');
						break;
			}	}
			if (temp < 6004 || sel.childNodes[i].tagName == "OPTGROUP")
				continue;
			if (temp == 6004 || temp == 6006 || temp == 6007 || temp == 6008
				|| temp == 6011 || temp == 6014 || temp == 6015)
				sel.childNodes[i].innerHTML =
					sel.childNodes[i].innerHTML.substr(4);
		}
		if (json == '{') json = ''; else json += '}';
		SetCharData("hplist", json);
	}

	// Store list of restoratives we care about
	var vich = document.getElementsByName("whichitem");		// the MP-restorers item dropdown.
	if (vich[0] != undefined)
	{	var json = "{"; var opt = vich[0].childNodes;
		for (i=0, len=opt.length; i<len; i++)
		{	var optval = opt[i].value; var temp;
			switch (parseInt(optval))
			{	case 344: case 1559: case 518: case 1658: case 1659: case 1660: case 2639:
					if (opt[i].innerHTML.indexOf('(') == -1) temp = 1;
					else
					{	temp = opt[i].innerHTML.split('(')[1];
						temp = temp.split(')')[0];
					} json += "\""+optval+"\":"+temp+","; break;
				default: break;
		}	}
		if (json == '{') json = ""; else json += "}";
		SetCharData("mplist",json);
	}

	for (var i=0, len=inputStuff.length; i<len; i++)
	{	var temp = inputStuff[i];

		// Attach maximum skills event handler and "Max" button
		if (temp.value == "1" && temp.name == "quantity")
		{	temp.addEventListener('keydown', function(event)
			{	if (event.which == 77 || event.which == 88 || event.which == 72) // 'm', 'x', 'h'
				{	var selectItem = document.getElementsByName('whichskill')[0];
					var cost = ParseSelectQuantity(selectItem, " ");
					var limit = SkillUseLimit(selectItem.options[selectItem.selectedIndex].value);
					var val = parseInt(GetData("currentMP") / cost);
					if (event.which == 72) val = parseInt(val/2); // half
					if (val > limit) this.value = limit;
					else this.value = val;					
					event.stopPropagation(); event.preventDefault();
				} else if (ENABLE_QS_REFRESH == 1 && event.which == 82) self.location.reload();	// 'r'
			}, true);

			if (!miniSkills && temp.getAttribute('id') != 'skilltimes')
			{	MakeMaxButton(temp, function(event)
				{	var selectItem = document.getElementsByName('whichskill')[0];
					var box = document.getElementsByName('quantity')[0];
					var cost = ParseSelectQuantity(selectItem, " ");
					var limit = SkillUseLimit(selectItem.options[selectItem.selectedIndex].value);
					var val = parseInt(GetData("currentMP") / cost);
					if (val > limit) box.value = limit;
					else box.value = val;
				});
			}	
		}

		// Attach maximum buffs event handler and "Max" button
		if (temp.value == "1" && temp.name == "bufftimes")
		{	
			var padding = document.createElement('div');
			padding.setAttribute('style','padding-top: 4px');
			temp.parentNode.insertBefore(padding, temp);
			temp.addEventListener('keydown', function(event)
			{	if (event.which == 77 || event.which == 88) // 77 = 'm', 88 = 'x'
				{	var selectItem = document.getElementsByName('whichskill')[1];
					var cost = ParseSelectQuantity(selectItem, " ");
					this.value = parseInt(GetData("currentMP") / cost);
					event.stopPropagation(); event.preventDefault();
				}	
			}, true);
			MakeMaxButton(temp, function(event)
			{	var selectItem = document.getElementsByName('whichskill')[1];
				var box = document.getElementsByName('bufftimes')[0];
				var cost = ParseSelectQuantity(selectItem, " ");
				box.value = parseInt(GetData("currentMP") / cost);
			});
		}

		// Attach maximum items event handler and "Max" button
		if (temp.value == "1" && temp.name == "itemquantity")
		{	temp.addEventListener('keyup', function(event)
			{	if (event.which == 77 || event.which == 88 || event.which == 72) // 77 = 'm', 88 = 'x', 72 = 'h'
				{	var selectItem = document.getElementsByName('whichitem')[0];
					var quant = ParseSelectQuantity(selectItem, ")");
					var index = selectItem.selectedIndex;
					var val = FindMaxQuantity(selectItem.options[index].value, quant, 0, GetPref('safemax'));
					if (event.which == 72) val = parseInt(val/2); // half
					this.value = val;
					event.stopPropagation(); event.preventDefault();
				} else if (ENABLE_QS_REFRESH == 1 && event.which == 82) self.location.reload();	// 82 = 'r'
			}, false);

			if (!miniSkills)
			{	MakeMaxButton(temp, function(event)
				{	var selectItem = document.getElementsByName('whichitem')[0];
					var index = selectItem.selectedIndex;
					var box = document.getElementsByName('itemquantity')[0];
					var quant = ParseSelectQuantity(selectItem, ")");
					box.value = FindMaxQuantity(selectItem.options[index].value, quant, 0, GetPref('safemax'));
				});
			}
			break;
		}
	}
}

// -----------------------------------------------------------------
// MULITUSE: Autofill the proper "maxed-out" number in the use box.
// -----------------------------------------------------------------
function at_multiuse()
{	var inputStuff = document.getElementsByTagName("input");
	for (var i=0, len=inputStuff.length; i<len; i++)
	{	var temp = inputStuff[i];
		if (temp.name == "quantity")
		{	temp.addEventListener('keydown', function(event)
			{	if (event.which == 77 || event.which == 88) // 'm', 'x'
				{	this.value = "";
					//event.stopPropagation(); event.preventDefault();
				}
			}, true);

			temp.addEventListener('keyup', function(event)
			{	if (event.which == 77 || event.which == 88) // 77 = 'm', 'x'
				{	var selectItem = document.getElementsByName("whichitem")[0];
					var quant = ParseSelectQuantity(selectItem, ")");
					var index = selectItem.selectedIndex;
					this.value = FindMaxQuantity(selectItem.options[index].value, quant, 1, GetPref('safemax'));
				} event.stopPropagation(); event.preventDefault();
			}, false);

			MakeMaxButton(temp, function(event)
			{	var box = document.getElementsByName('quantity')[0];
				var selectItem = document.getElementsByName('whichitem')[0];
				var quant = ParseSelectQuantity(selectItem, ")");
				var index = selectItem.selectedIndex;
				box.value = FindMaxQuantity(selectItem.options[index].value, quant, 1, GetPref('safemax'));
			});
			break;
		}
	}
}

// -------------------------
// MR. KLAW: Mr. Vanity Klaw
// -------------------------
function at_clan_rumpus()
{	if (document.location.search == "?action=click&spot=3&furni=3" && GetPref('klaw') == 1)
	{	var tr = $('table:first tr:first:contains(Results)');
		if (tr.length > 0)
		{	txt = tr.next().text();
			if (txt.indexOf("wisp of smoke") == -1 &&
				txt.indexOf("broken down") == -1 &&
				txt.indexOf("claw slowly descends") != -1)
			window.setTimeout('self.location = "http://' + server +
				'/clan_rumpus.php?action=click&spot=3&furni=3";',500);
		}
	}
}

// ---------------------------------
// MR. VIP KLAW: look, more stuffies
// 21Dec09 Hellion: created (okay, copied shamelessly from at_clan_rumpus() )
// ---------------------------------
function at_clan_viplounge()
{	if (document.location.search == "?action=klaw" && GetPref('klaw') == 1)
	{	var tr= $('table:first tr:first:contains(Results)');
		if (tr.length > 0)
		{	txt = tr.next().text();
			if (txt.indexOf("You probably shouldn't play") == -1) 
			{	window.setTimeout('self.location = "http://' + server + 
				'/clan_viplounge.php?action=klaw";',500);
			}
		}
	}
}

// -------------------------------------------------------
// THESEA: if the sea is not present, talk to the old man.
// -------------------------------------------------------
function at_thesea()
{	if (document.body.textContent.length == 0)
		top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/oldman.php?action=talk';
}

// --------------------------------------------------------------------
// OLDMAN: If the old man is not present, put up a SCUBA gear reminder.
// --------------------------------------------------------------------
function at_oldman()
{ 	if (document.body.textContent.length == 0) {
		var style = $(document.createElement('style'))
			.attr('type', 'text/css')
			.html("body {font-family: Arial, Helvetica, sans-serif; background-color: white; color: black;} " +
			"td {font-family: Arial, Helvetica, sans-serif;} input.button {border: 2px black solid; " +
			"font-family: Arial, Helvetica, sans-serif; font-size: 10pt; font-weight: bold; background-color: #FFFFFF;}");
		//document.firstChild.firstChild.appendChild(style);
		$('head').append(style);

		var tabl = $(document.createElement('table'))
			.attr('width','95%')
			.attr('style','font-family: Arial, Helvetica, sans-serif')
			.attr('cellspacing','0')
			.attr('cellpadding','0')
			.append(document.createElement('tbody'));
		tabl.children('tbody')
			.append(document.createElement('tr'))
			.append(document.createElement('tr'));
		var td = $(document.createElement('td'))
			.attr('bgcolor','blue')
			.attr('align','center')
			.attr('style','color: white;')
			.html('<b>No old man, see?</b>');
		tabl.find('tbody tr:first').append(td);
		td = $(document.createElement('td'))
			.attr('style','border: 1px solid blue; padding: 5px;')
			.attr('align','center')
			.append('<p>You need some makeshift SCUBA gear, matey.<br>');
		tabl.find('tbody tr:eq(1)').append(td);
		var centre = $(document.createElement('center'))
			.append(tabl);
		$('body').append(centre);
	}
}

// -------------------------------------------------
// MANOR: If manor is not present, redirect to town.
// -------------------------------------------------
function at_manor()
{	if (document.body.textContent.length == 0)
		top.document.getElementsByName('mainpane')[0].contentDocument.location.pathname = '/town_right.php';
	else if (GetPref('zonespoil') == 1)
	{
		$('img').each(function()
		{	var img = $(this);
			var src = img.attr('src');
			if (src.indexOf("sm1.gif") != -1)
				img.attr('title','ML: 105-115');
			else if (src.indexOf("sm4.gif") != -1)
				img.attr('title','ML: 20');
			else if (src.indexOf("sm3.gif") != -1)
				img.attr('title','ML: 7-9');
			else if (src.indexOf("sm6.gif") != -1)
				img.attr('title','ML: 3-5');
			else if (src.indexOf("sm7.gif") != -1)
				img.attr('title','ML: 49-57');
			else if (src.indexOf("sm9.gif") != -1)
				img.attr('title','ML: 1-2');
		});
}	}

// ---------------------------------------
// MANOR3: display wine-bottle glyph info.
// ---------------------------------------
function at_manor3()
{
// basic spoilers, part 1: display glyphs while selecting the wines.
	var wineDB = {'2275':'278847834','2271':'163456429','2276':'147519269',
				  '2273':'905945394','2272':'289748376','2274':'625138517'};

// new way: use the glyph info we scraped once while building the wine list.
	$('select:first').change(function()
	{	
	var winelist = eval('('+GetCharData("winelist")+')');	// {2271:["name",glyphid], 2272:["name",glyphid], etc.}
	var wine = this.childNodes[this.selectedIndex].value;
		if (wine > 0) {
			var glyph = $('#daglyph');
			if (glyph.length == 0)		// if it doesn't exist, add it.
			{	$('select:first').parent().parent().append(
					$(document.createElement('img')).attr('id', 'daglyph'));
				glyph = $('#daglyph');
			}
			glyph.attr('src',
				'http://images.kingdomofloathing.com/' +
				'otherimages/manor/glyph'+winelist[wine][1]+'.gif');
		}
	});
	
// old way: scrape the description every time we change the wine selection.	
//	$('select:first').change(function()
//	{	var wine = this.childNodes[this.selectedIndex].value;
//		if (wine > 0) GM_get(server +
//			"/desc_item.php?whichitem=" + wineDB[wine],
//		function(txt)
//		{	var num = txt.charAt(txt.indexOf("/glyph") + 6);
//			var glyph = $('#daglyph');
//			if(glyph.length == 0)
//			{	$('select:first').parent().parent().append(
//					$(document.createElement('img')).attr('id', 'daglyph'));
//				glyph = $('#daglyph');
//			}
//			glyph.attr('src',
//				'http://images.kingdomofloathing.com/' +
//				'otherimages/manor/glyph'+num+'.gif');
//		});
//	});
	
// basic spoilers, part 2: link to equip spectacles when needed.
// this part is all-but-unnecessary, only being needed on someone's first runthrough, but
// we'll leave it here on the off chance that someone uses Mr. Script that early in their KoL career.
	$('img[src*=lar2a]')
		.attr('title','Click to Equip Spectacles')
		.attr('border','0')
		.wrap('<a target="mainpane" href="inv_equip.php?pwd=' +
			pwd + '&which=2&action=equip&whichitem=1916&slot=3"></a>');

// advanced spoilers:
// phase 1: generate "which wine is in which corner" spoilage.

	var winelist = [];
	var wineeffectlist = {
		1:"3-4 adv/2 drunk", 
		2:"Effect: Full of Vinegar",
		3:"3-4 adv/2 drunk, Effect: Kiss of the Black Fairy",
		4:"5-7 adv/2 drunk",
		5:"3-4 adv/2 drunk, lose 60-70% of maxHP",
		6:"0 adv/2 drunk, lose 80-90% of maxHP"
	};
	var wineConfig = {
		0:[25,"Merlot, Pinot Noir, Port"], 
		1:[42,"Marsala, Pinot Noir, Zinfandel"], 
		2:[52,"Muscat, Port, Zinfandel"],
		3:[7,"Marsala, Merlot, Muscat"]
	};
	var CornerSpoilers = document.createElement('table');
	CornerSpoilers.setAttribute('border','1');

	// get the what-dropped-where info that we grabbed in at_fight().
	var NW = GetCharData("corner178"); if (NW === undefined) NW = 0;
	var NE = GetCharData("corner179"); if (NE === undefined) NE = 0;
	var SW = GetCharData("corner180"); if (SW === undefined) SW = 0;
	var SE = GetCharData("corner181"); if (SE === undefined) SE = 0;
	// load it up into an array for comparing "what-dropped-where" with "what-combos-are-possible".
	var oldsum = 0;
	var newsum = 0;
	var match = {178:[0,0,0,0,0],179:[0,0,0,0,0],180:[0,0,0,0,0],181:[0,0,0,0,0],182:[0,0,0,0,0]};
	for (i=0;i<4;i++) {
		match[178][i] = ((NW | wineConfig[i][0]) == wineConfig[i][0])? 1: 0;
		match[179][i] = ((NE | wineConfig[i][0]) == wineConfig[i][0])? 1: 0;
		match[180][i] = ((SW | wineConfig[i][0]) == wineConfig[i][0])? 1: 0;
		match[181][i] = ((SE | wineConfig[i][0]) == wineConfig[i][0])? 1: 0;
	}
	for (n=178;n<182;n++) {				// calculate the "sum-of" data.  If the total of the first 4 columns is 1, this row is
		for (i=0; i<4; i++) {			// fully ID'd--only 1 possible configuration matches what dropped.  Conversely, if the
			match[n][4] += match[n][i];	// total of the first 4 row entries is 1, only 1 drop pattern is left that can fit that
			match[182][i] += match[n][i];	// configuration.
			newsum = newsum + match[n][i];
		}
	}

	// reduce the matrix of drops-vs.-possibilities to its most-restricted form:
	while (oldsum != newsum) {
		oldsum = newsum;
		// reduce the matrix of possibilities row-wise
		for (check=178; check<182; check++) {
			if (match[check][4] == 1) {								// fully-ID'd row?
				for (i=0; i<4; i++) if (match[check][i]) break;		// find the set ID column
				for (set=178; set<182; set++) {						// unset it in all the other rows
					if (set==check) continue;						// I said all the OTHER rows, see?
					if (match[set][i] == 1) {						// if it's set,
						match[set][4] -= 1;							//    decrement the sum-of-array total
						match[182][i] -= 1;							//    and the other sum-of-array total
						newsum--;									//    and the sum-of-sum total
						match[set][i] = 0;							//    and unset it.
					}
				}
			}
		}
		// and then reduce it column-wise
		for (check=0;check<4;check++) {
			if (match[182][check] == 1) {								// fully-ID'd column?
				for (j=178;j<182; j++) if (match[j][check]) break;		// find the set ID row
				for (set=0; set<4; set++) {							// unset it in all the other columns
					if (set==check) continue;						// I said all the OTHER columns, see?
					if (match[j][set] == 1) {						// if it's set,
						match[j][4] -= 1;							//    decrement the sum-of-array total
						match[182][set] -= 1;						//    and the other sum-of-array total
						newsum--;									//    and the sum-of-sum total
						match[j][set] = 0;							//    and unset it.
					}
				}
			}
		}
	}	
	
	// convert out array of drop possibilities into a list of corners for display.
	var possibilities = ["","","",""];
	var cornername = {178:" NW ", 179: " NE ", 180:" SW ", 181:" SE "};
	for (i=0; i<4; i++) {
		for (n=178; n<182; n++) if (match[n][i] == 1) possibilities[i] += cornername[n];
	}

	// build the display table.
	var th1 = document.createElement('th');
	th1.textContent = "this set of wines:";
	CornerSpoilers.appendChild(th1);
	th1 = document.createElement('th');
	th1.textContent = "could be in the:";
	CornerSpoilers.appendChild(th1);
	
	var tr1;
	var td1;	
	for (i=0;i<4;i++) {
		tr1 = document.createElement('tr');
		td1 = document.createElement('td');
		td1.textContent = wineConfig[i][1];
		tr1.appendChild(td1);
		td1 = document.createElement('td');
		td1.textContent = possibilities[i];
		tr1.appendChild(td1);
		CornerSpoilers.appendChild(tr1);
	}

// phase 2: get info about which wine is which glyph this run
	// helper function 1: get the glyph info out of a wine's description page
	function scrape(txt) {
		var bottleOf = txt.match(/dusty bottle of (.*?)\</)[1];
		var glyphNum = txt.match(/\/glyph([0-9])/)[1];
		var bInfo = [bottleOf, glyphNum];	
		return bInfo;
	}
	// helper function 2: check player inventory for quantity of wines.
	function countWines(wl, needs) {	
	// wl is an array of bInfo's from the scrape() function; needs is an array of the wine IDs that are required for the altar.
		GM_get(server+'/js_inv.php?for=MrScript',function(response) {
			if (response[0] != '{') {		
				var i1 = response.split('inventory = ')[1].split(';')[0];	// should get everything from { to }, inclusive.
				response = i1;
			}
			var invcache = eval('('+response+')');
			var dustyX;
			var dustylist = new Array();
			for (var i=2271; i<2277; i++) {
				dustyX = invcache[i]; if (dustyX === undefined) dustyX = 0;
				dustylist[i] = dustyX;
			}
			var youNeed = "You need: ";
			if (needs[0] == undefined) {	// may be undefined due to calling this function after the altar is completed.
				youNeed = "";
			} else {
				for (i=0;i<3;i++) {
					youNeed += winelist[needs[i]][0];
					youNeed += " (you have "+dustylist[needs[i]]+"), ";
				}
				youNeed = youNeed.slice(0, -2);
			}
			getWinelist.innerHTML = youNeed;
		});
	}

	var wineDisplay = document.createElement('table');
	wineDisplay.setAttribute('id','wineDisplay');
	wineDisplay.setAttribute('cellpadding','2');
	wineDisplay.setAttribute('width','95%');
	wineDisplay.style.display = "none";
	
	function toggleDisplay()
	{	if (wineDisplay.style.display == "none") {
			wineDisplay.style.display = "block";
		} else {
			wineDisplay.style.display = "none";
		}
	}

	var wineToggler = document.createElement('span');
	var wtl = document.createElement('u');
	wtl.textContent = "[Toggle Wine List display]";
	with (wineToggler) {
		appendChild(wtl);
		className = "toggler";
		addEventListener('click',toggleDisplay,'true');
	}
	
	var getWinelist = document.createElement('p');
	document.body.appendChild(getWinelist);
	document.body.appendChild(CornerSpoilers);
	document.body.appendChild(wineToggler);
	getWinelist.innerHTML='Checking wine information....';
	
	
	var wineHTML = GetCharData("wineHTML");
	var winesneeded;
	if (wineHTML != undefined && wineHTML.length > 0) {	// If we already did this the long way, just display the saved results.
		wineDisplay.innerHTML = wineHTML;
		winelist = eval('('+GetCharData("winelist")+')');
		winesneeded = eval('('+GetCharData("winesNeeded")+')');
		document.body.appendChild(wineDisplay);
		countWines(winelist, winesneeded); 
	} else {											// No saved results: Better do it the long way.... 
		GM_get(server+"/manor3.php?place=goblet", function (atext) {	// check the altar for the glyphs we need
			var pdiv = document.createElement('div');
//			GM_log("place=goblet text:"+atext);
			pdiv.innerHTML = atext;
			var glimgs = pdiv.getElementsByTagName('img');
			var glyphids = new Array();
			if (glimgs[0].getAttribute('src').indexOf('cellar1') != -1) {	// no glyphs?!  You must be missing something.
				getWinelist.innerHTML = 
					"You need: Lord Spookyraven's spectacles! <font size='2'><a href=adventure.php?snarfblat=108>[bedroom]</a></font>";
				return;
			} // else...
			if (atext.indexOf("Nothing more to see here.") == -1) {	// make sure we're not trying this after the chamber has been emptied
				glyphids[0] = glimgs[0].getAttribute('src').match(/(?:otherimages\/manor\/glyph)(\d)/)[1];
				glyphids[1] = glimgs[1].getAttribute('src').match(/(?:otherimages\/manor\/glyph)(\d)/)[1];
							//glimgs[2] is the big encircled-triangle in the middle.
				glyphids[2] = glimgs[3].getAttribute('src').match(/(?:otherimages\/manor\/glyph)(\d)/)[1];
			}
			GM_get(server+"/desc_item.php?whichitem="+wineDB[2271], function(b1) {	// get the glyph number off the wine descriptions
				winelist[2271]=scrape(b1);
				GM_get(server+"/desc_item.php?whichitem="+wineDB[2272], function(b2) {
					winelist[2272] = scrape(b2);
					GM_get(server+"/desc_item.php?whichitem="+wineDB[2273], function(b3) {
						winelist[2273] = scrape(b3);
						GM_get(server+"/desc_item.php?whichitem="+wineDB[2274], function(b4) {
							winelist[2274] = scrape(b4);
							GM_get(server+"/desc_item.php?whichitem="+wineDB[2275], function(b5) {
								winelist[2275] = scrape(b5);
								GM_get(server+"/desc_item.php?whichitem="+wineDB[2276], function(b6) {
									winelist[2276] = scrape(b6);
									wineDisplay.innerHTML = "<tr><th>Name:</th><th>Glyph:</th><th>Effect:</th></tr>";
									for (var i=2271;i<2277;i++) {
										wineDisplay.innerHTML += "<tr><td align=center>" + winelist[i][0]+"</td><td align=center>"+
										"<img src=http://images.kingdomofloathing.com/otherimages/manor/glyph"+winelist[i][1]+".gif"+
										" </td><td>Yields "+wineeffectlist[winelist[i][1]]+"</td></tr>";
									}
									document.body.appendChild(wineDisplay);

									// this was an expensive process, let's only do it once.  Save the table display:
									SetCharData("wineHTML",wineDisplay.innerHTML);	
									// and save the list of wine->glyph mappings and the list of which wines we actually need.
									var json = "{"; var json2 = "{";
									for (i=2271;i<2277;i++) {
										for (j=0;j<glyphids.length;j++)
										if (winelist[i][1] == glyphids[j]) json = json + j + ":" + i + ",";
										json2 = json2 + i+':["'+winelist[i][0]+'",'+winelist[i][1]+'],';
									}
									json = json + "}"; json2 = json2 + "}";
									SetCharData("winesNeeded",json);
									SetCharData("winelist",json2);
									winesneeded = eval('('+json+')');
									countWines(winelist, winesneeded);
								});
							});
						});
					});
				});
			});
		});
	}
}

// ----------------------------------------------------------------
// PALINSHELVES: fill in the correct choices to summon Dr. Awkward.
// ----------------------------------------------------------------
function at_palinshelves()
{	for (var i=0,len=document.images.length; i<len; i++)
	{	var img = document.images[i];
		var onclick = img.getAttribute("onclick");
		if (onclick != undefined && onclick.indexOf("desc") != -1)
			AddLinks(onclick, img.parentNode.parentNode, null, thePath);
	} var sels = document.getElementsByTagName('select');
	if (sels.length > 0)
	{	sels[0].value = 2259; sels[1].value = 2260;
		sels[2].value = 493; sels[3].value = 2261;
}	}

// --------------------------------------------
// PYRAMID: Display ratchets and other goodies.
// --------------------------------------------
function at_pyramid()
{
	var ratch = document.createElement('a');
	ratch.innerHTML = '<font size="2">[use a ratchet]</font>';
	ratch.setAttribute('href',
		'inv_use.php?pwd=' + pwd + '&which=3&whichitem=2540');
	var checkInv = document.createElement('a');
	checkInv.innerHTML = '<font size="2">[check inventory]</font>';
	checkInv.setAttribute('href', '#');
	checkInv.addEventListener('click', function(evt)
	{	checkInv.innerHTML = '<font size="2">[checking...]</font>';
		GM_get(server+'/js_inv.php?for=MrScript',function(response) {
			if (response[0] != '{') {		
				var i1 = response.split('inventory = ')[1].split(';')[0];	// should get everything from { to }, inclusive.
				response = i1;
			}
			var invcache = eval('('+response+')');
			var ratchet = invcache[2540]; if (ratchet === undefined) ratch = 0;
			var token = invcache[2317]; if (token === undefined) token = 0;
			var bomb = invcache[2318]; if (bomb === undefined) bomb = 0;
			var html = "You have ";
			if (token > 0) html += "an ancient bronze token";
			else if (bomb > 0) html += "an ancient bomb";
			if (ratchet > 0) {
				if (html != "You have ") html += " and ";
				html += ratchet + " <a href='inv_use.php?pwd=";
				html += pwd + "&which=3&whichitem=2540'>tomb ratchet"; if (ratchet > 1) html += "s"; 
				html += "</a>";
			}
			if(html == "You have ") html = "Nothing special in inventory. (Sorry.)";
			if (document.location.pathname == "/pyramid.php")
			{	$('#pyr_inv').html('<br /><font size="2">'+html+'</font>');
			}			
		});
	}, false);

	var pyr = document.createElement('div');
	pyr.setAttribute('id', 'pyr_inv');
	pyr.setAttribute('style','text-align:center;');
	pyr.appendChild(ratch);
	pyr.appendChild(document.createTextNode(' - '));
	pyr.appendChild(checkInv);
	var t = document.getElementsByTagName('table');
	t[t.length-2].parentNode.appendChild(pyr);

// pyramid de-ratter cheerfully swiped from JiK4Eva
	var elements = document.getElementsByTagName("td");
    for(var i=0;i<elements.length;i++){
		var q = elements[i].innerHTML;
		// replace the <a><img></a> with just <img> if we're on image 2 or 5.
		// this renders the "rats" portions of the pyramid unclickable.  yay.
		// must match the href at the start of the TD element only, or this will over-match and step on our ratchet/inv links above.
		if (q.match(/^<a href="pyramid\.php\?action=lower">.*pyramid4_[25]\.gif/)) {	
			elements[i].innerHTML = q.replace(/<a href="pyramid\.php\?action=lower">(<img src="[^>]*pyramid4_[25]\.gif"[^>]*>)<\/a>/, "$1");
		}
    }
// end de-ratter
}

// -------------------
// LAIR: More linkies.
// -------------------
function at_lair1()
{
//	GM_log(document.location);
	if (document.location.search != "?action=gates") return;
	for (var i=0; i<3; i++)
	{	var p = document.getElementsByTagName('p')[i];
		var ptxt = p.textContent;
// gate 1: 
		if (ptxt.indexOf("Suc Rose") != -1) p.appendChild(AppendLink('[sugar rush]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=540'));
		else if (ptxt.indexOf("Hilarity") != -1) p.appendChild(AppendLink('[gremlin juice]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=2631'));
		else if (ptxt.indexOf("Humility") != -1) p.appendChild(AppendLink('[wussiness]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=469'));
		else if (ptxt.indexOf("Morose Morbidity") != -1) p.appendChild(AppendLink('[thin black candle]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=620'));
		else if (ptxt.indexOf("Slack") != -1) p.appendChild(AppendLink('[mick\'s IVH rub]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=618'));
		else if (ptxt.indexOf("Spirit") != -1) p.appendChild(AppendLink('[pygmy pygment]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=2242'));
		else if (ptxt.indexOf("Porcupine") != -1) p.appendChild(AppendLink('[super-spiky hair gel]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=587'));
		else if (ptxt.indexOf("Viper") != -1) p.appendChild(AppendLink('[adder bladder]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=2056'));
		else if (ptxt.indexOf("Locked Gate") != -1) p.appendChild(AppendLink('[black no. 2]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=2059'));
// gate 2:
			else if (ptxt.indexOf("Machismo") != -1) p.appendChild(AppendLink('[meleegra]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=1158'));
		else if (ptxt.indexOf("Flame") != -1) p.appendChild(AppendLink('[jabanero gum]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=300'));
		else if (ptxt.indexOf("Intrigue") != -1) p.appendChild(AppendLink('[handsomeness]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=1162'));
		else if (ptxt.indexOf("Mystery") != -1) p.appendChild(AppendLink('[pickle gum]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=299'));
		else if (ptxt.indexOf("the Dead") != -1) p.appendChild(AppendLink('[marzipan skull]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=1163'));
		else if (ptxt.indexOf("Torment") != -1) p.appendChild(AppendLink('[tamarind gum]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=297'));
		else if (ptxt.indexOf("Zest") != -1) p.appendChild(AppendLink('[lime & chile gum]',
			'inv_use.php?pwd='+pwd+'&which=3&whichitem=298'));
// gate 3:
		else if (ptxt.indexOf("Hidden") != -1) p.appendChild(AppendLink('[dod potion - object]','multiuse.php'));
		else if (ptxt.indexOf("Light") != -1) p.appendChild(AppendLink('[dod potion - moxie]','multiuse.php'));
		else if (ptxt.indexOf("Mind") != -1) p.appendChild(AppendLink('[dod potion - myst]','multiuse.php'));
		else if (ptxt.indexOf("Ogre") != -1) p.appendChild(AppendLink('[dod potion - muscle]','multiuse.php'));
		else if (ptxt.indexOf("Not a Gate") != -1) p.appendChild(AppendLink('[dod potion - teleport]','multiuse.php'));
	}
}

// -----------------------------
// at_lair2: I am the keymaster!
// (function shamelessly lifted from Tard's NS Trainer v0.8
// -----------------------------
function at_lair2()
{
	if (GetPref("lairspoil") == 1) {
		var bodyHTML = document.getElementsByTagName("body")[0].innerHTML;
		if (bodyHTML.indexOf("10 buttons must ye push") != -1) {
			var selects = document.getElementsByTagName("select");
			// n.b. selects[0] and [1] are already set to the correct value of 0.
			selects[2].options.selectedIndex = 1;
			selects[3].options.selectedIndex = 1;
			selects[4].options.selectedIndex = 2;
			selects[5].options.selectedIndex = 3;
			selects[6].options.selectedIndex = 2;
			selects[7].options.selectedIndex = 3;
			selects[8].options.selectedIndex = 4;
			selects[9].options.selectedIndex = 5;
		} else if (bodyHTML.indexOf("Though spelling's not our strongest case") != -1) {
			document.getElementsByTagName("input")[1].value = "phish";
		} else if (bodyHTML.indexOf("I am a fish, blind as can be") != -1) {
			document.getElementsByTagName("input")[1].value = "fsh";
		} else if (bodyHTML.indexOf("I do not walk, I do not fly") != -1) {
			document.getElementsByTagName("input")[1].value = "fish";
		}
	}
}

// ---------------------------------------
// at_lair6: links, door codes, familiars.
// ---------------------------------------
function at_lair6()
{	var tabl = document.getElementsByTagName('table');
	img = document.images;
	if (tabl[1].innerHTML.indexOf("fying seri") != -1)
	{	tabl[1].parentNode.innerHTML +=
		"<br><a href='inv_equip.php?pwd="+pwd+
		"&which=2&action=equip&whichitem=726'>Equip Shard</a>";
	}
	if (img.length == 2 && img[1].src.indexOf("gash.gif") != -1)
	{	var zif = img[1].parentNode.parentNode;
		zif.setAttribute('align','center');
		zif.innerHTML += "<br><br><a class='tiny' href='storage.php'>Hagnk's</a>";
		zif.innerHTML += "<br><a class='tiny' href='inv_equip.php?pwd="+pwd+"&action=unequipall'>get nekkid</a>";
		zif.innerHTML += "<br><br><br><a class='tiny' href='inventory.php?which=1&action=discard&pwd="+pwd+"&whichitem=4448'>discard a karma</a>";
	}	
// door and familiar coding shamelessly borrowed from Tard's NS Trainer script v0.8
	if (window.location.search == "" && GetPref("lairspoil") == 1) {
		aP = document.getElementsByTagName("p");
		if (aP[1] && aP[1].innerHTML.indexOf("BEWARE") != -1) {
			p7 = aP[11].innerHTML;
			p5 = aP[9].innerHTML;
			p6 = aP[10].innerHTML;
			p8 = aP[12].innerHTML;
			p11 = aP[15].innerHTML;
			p13 = aP[17].innerHTML;
			p14 = aP[18].innerHTML;
			if (p7.match(/\d/)) {
				S = p5.match(/\d/)[0];
				T = p6.match(/\d/)[0];
				V = p8.match(/\d/)[0];
				Z = p13.match(/\d/)[0];
				if (p13.indexOf("East") != -1) {
					SetData("NSDoorCode",String.concat(T,V,Z));
				} else {
					SetData("NSDoorCode",String.concat(S,V,Z));
				}
			} else {
				T = p5.match(/\d/)[0];
				X = p11.match(/\d/)[0];
				Y = p14.match(/\d/)[0];
				SetData("NSDoorCode",String.concat(T,X,Y));
			}
		} else {
			code = GetData("NSDoorCode");
			if (code && document.getElementsByTagName("input")[1]) document.getElementsByTagName("input")[1].value = code;
		}
	} else if (GetPref("lairspoil") == 1 && (window.location.search == "?place=3" || window.location.search == "?place=4")) {
		window.addEventListener("load",function(e) {
			var bodyHTML = document.getElementsByTagName("body")[0].innerHTML;
			var newDiv = document.createElement("div");
			newDiv.id = "nsTools";
			document.getElementsByTagName("center")[0].insertBefore(newDiv,document.getElementsByTagName("table")[0]);
			var oDiv = document.getElementById("nsTools");
			with(oDiv.style) {width = "95%";marginBottom="10px"}

			newDiv = document.createElement("div");
			with(newDiv) {id = "nsToolsHead";innerHTML = "Naughty Sorceress Tools:";}
			with(newDiv.style) {background = "blue";textAlign = "center";fontSize = "16px";color="white";fontWeight="bold";}
			oDiv.appendChild(newDiv);

			newDiv = document.createElement("div");
			with(newDiv) {id = "nsToolsContent";}
			with(newDiv.style) {textAlign = "center";fontSize = "13px";border="1px solid blue";borderTop="0px";padding="5px";}
			oDiv.appendChild(newDiv);
			oDiv = document.getElementById("nsToolsContent");
			var famId,famName;
			if (bodyHTML.indexOf("goat.gif") != -1) {
				famId = 1;famName = "Mosquito";
			} else if (bodyHTML.indexOf("mosquito.gif") != -1) {
				famId = 5;famName = "Sabre-Toothed Lime";
			} else if (bodyHTML.indexOf("lime.gif") != -1) {
				famId = 3;famName = "Levitating Potato";
			} else if (bodyHTML.indexOf("potato.gif") != -1) {
				famId = 8;famName = "Barrrnacle";
			} else if (bodyHTML.indexOf("barrrnacle.gif") != -1) {
				famId = 4;famName = "Angry Goat";
			}
			if (famId) oDiv.innerHTML = '<a href="familiar.php?action=newfam&newfam=' + famId + '">Use the ' + famName + ', Luke!</a>';
		},false);
	}
// end shameless code borrowing
}

// -------------------------------------------------
// FAMILIAR: Blackbird singing in the dead of night.
// -------------------------------------------------
function at_familiar()
{
	if($('img:first').attr('src').indexOf('blackbird2') != -1 ||
		$('input[value=59]').length > 0)
	{
		var fly = document.createElement('a');
		fly.innerHTML = '[fly, fly, fly]';
		fly.setAttribute('href', 'javascript:void(0);');
		$(fly).click(BlackBirdStuff);
		var p = document.createElement('p');
		p.setAttribute('style', 'font-weight:bold;');
		p.appendChild(document.createTextNode('Blackbird: '));
		p.appendChild(fly);
		$('form:first').parent('center').prepend(p);
	}
}

// ------------------------------------------
// MINING: uber-twinklify all twinkly images.
// ------------------------------------------
function at_mining() 
{
// Image courtesy of Picklish's Mining Helper script.
	var staticSparkleImg = "data:image/gif;base64,R0lGODlhMgAyAOMPAP39/dvb2zc3NycnJ5qams3NzQUFBRAQEGtra6enp7W1te3t7UZGRldXV319ff///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQJAQAPACwAAAAAMgAyAAAEW/DJSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru8rg/AUR+AAfBwCgd/OMFA4GguEQXcEJAQEQGM3ECAAUSIwkJgWn0WJwZxuu9/wuHxOr9vv+Lx+z+/77xEAIfkECQEADwAsAAAAADIAMgAABGvwyUmrvTjrzbv/YCiOZGmeaKqubOu+cCzPdG3feM4Jhm4FA18lIRBSEgzjpKDoGRmLAsJAddYaBEJAMQB4AYqbIKuILhwCRlAXWKyNWaVEKn8kEHVCo36w1v+AgYKDhIWGh4iJiouMjY4kEQAh+QQJAQAPACwAAAAAMgAyAAAEl/DJSau9OOvNu/9gKI5kaZ5oqq5s675wLLeHMXNHYd/aAAy83i+YMRQERMwhgEhefA6npQFISCmGQEJ3NTAUhYMCYRM0CMCYoYEoAAi1Adi9OMoGhXwgIDAcHAsJDEE7Bgl8eQM7TkYACotXVA1XFD6DlBIDC2mYRpyUOUiYD56jpAWXowqfpq2ur7CxsrO0tba3uLm6GhEAIfkECQEADwAsAAAAADIAMgAABGvwyUmrvTjrzbv/YCiOZGmeaKqubOu+cCzPdG3feM4Jhm4FA18lIRBSEgzjpKDoGRmLAsJAddYaBEJAMQB4AYqbIKuILhwCRlAXWKyNWaVEKn8kEHVCo36w1v+AgYKDhIWGh4iJiouMjY4kEQAh+QQJAQAPACwAAAAAMgAyAAAEW/DJSau9OOvNu/9gKI5kaZ5oqq5s675wLM90bd94ru8rg/AUR+AAfBwCgd/OMFA4GguEQXcEJAQEQGM3ECAAUSIwkJgWn0WJwZxuu9/wuHxOr9vv+Lx+z+/77xEAOw==";
	$("img[src*=wallsparkle]").attr("src",staticSparkleImg);
}

// -------------------------
// OCEAN: Lat/Long spoilers.
// -------------------------
function at_ocean()
{	$("input[name=lat]").parents("table:first").before(
	'<select onchange="var spl=this.value.split(\',\'); document.getElementsByName(\'lon\')[0].value = spl[0]; document.getElementsByName(\'lat\')[0].value = spl[1];">'+
	'<option> </option>'+
	'<option value="12,84">Muscle 1</option>'+
	'<option value="23,66">Mysticality 1</option>'+
	'<option value="22,62">Moxie 1</option>'+
	'<option value="56,14">Muscle 2</option>'+
	'<option value="89,44">Mysticality 2</option>'+
	'<option value="13,91">Moxie 2</option>'+
	'<option value="19,59">Muscle 3</option>'+
	'<option value="13,86">Mysticality 3</option>'+
	'<option value="52,45">Moxie 3</option>'+
	'<option value="184,25">shimmering rainbow sand</option>'+
	'<option value="30,85">sinister altar fragment</option>'+
	'<option value="48,47">El Vibrato power sphere</option>'+
	'<option value="63,29">Plinth / Trapezoid</option>'+
	'<option value="37,37">Random Treasure</option>'+
	'</select>');
}

// ------------------------------
// CAMPGROUND: Telescope spoilers
// ------------------------------
function at_campground()
{
	var resultsBar = $('td:first:contains("Results")');
	if(GetPref("telescope") && resultsBar.length > 0
		&& resultsBar.parent().next().text()
		.indexOf('eyepiece of the telescope') != -1)
	{	resultsBar.parent().next().find('p').each(function(t)
		{	var txt = this.textContent;
			var snarf = false;
			if(txt.indexOf("carving of") != -1)
			{	var gate = txt.split("carving of ")[1];
				if(gate.indexOf("an armchair") != -1)
					snarf = ['pygmy pygment','pigment',
					'hiddencity.php','hidden city'];
				else if(gate.indexOf("cowardly-l") != -1)
					snarf = ['wussiness potion','potion5',
					'friars.php','deep fat friars'];
				else if(gate.indexOf("banana peel") != -1)
					snarf = ['gremlin juice','potion6',
					'bigisland.php?place=junkyard','island'];
				else if(gate.indexOf("coiled viper") != -1)
					snarf = ['adder bladder','bladder',
					'adventure.php?snarfblat=111','black forest'];
				else if(gate.indexOf("a rose") != -1)
					snarf = ['Angry Farmer candy','rcandy',
					'adventure.php?snarfblat=82','castle in the sky'];
				else if(gate.indexOf("glum teenager") != -1)
					snarf = ['thin black candle','bcandle',
					'adventure.php?snarfblat=82','castle in the sky'];
				else if(gate.indexOf("hedgehog") != -1)
					snarf = ['super-spiky hair gel','balm',
					'adventure.php?snarfblat=81','fantasy airship'];
				else if(gate.indexOf("a raven") != -1)
					snarf = ['Black No. 2','blackdye',
					'adventure.php?snarfblat=111','black forest'];
				else if(gate.indexOf("smiling man") != -1)
					snarf = ['Mick\'s IcyVapoHotness Rub','balm',
					'adventure.php?snarfblat=82','castle in the sky'];
			} else if(txt.indexOf("baseball bat") != -1)
				snarf = ['baseball','baseball',
				'adventure.php?snarfblat=31','guano junction'];
			else if(txt.indexOf("made of Meat") != -1)
				snarf = ['meat vortex','vortex',
				'adventure.php?snarfblat=80','valley'];
			else if(txt.indexOf("amber waves") != -1)
				snarf = ['bronzed locust','locust1',
				'beach.php','beach'];
			else if(txt.indexOf("slimy eyestalk") != -1)
				snarf = ['fancy bath salts','potion4',
				'adventure.php?snarfblat=107','bathroom'];
			else if(txt.indexOf("flaming katana") != -1)
				snarf = ['frigid ninja star','ninjastars',
				'adventure.php?snarfblat=62','ninja snowmen lair'];
			else if(txt.indexOf("translucent wing") != -1)
				snarf = ['spider web','web',
				'adventure.php?snarfblat=112','sleazy back alley'];
			else if(txt.indexOf("looking tophat") != -1)
				snarf = ['sonar-in-a-biscuit','biscuit',
				'adventure.php?snarfblat=31','guano junction'];
			else if(txt.indexOf("of albumen") != -1)
				snarf = ['black pepper','blpepper',
				'adventure.php?snarfblat=111','black forest'];
			else if(txt.indexOf("white ear") != -1)
				snarf = ['pygmy blowgun','tinyblowgun',
				'hiddencity.php','hidden city'];
			else if(txt.indexOf("cowboy hat") != -1)
				snarf = ['chaos butterfly','butterfly',
				'adventure.php?snarfblat=82','castle in the sky'];
			else if(txt.indexOf("periscope") != -1)
				snarf = ['photoprotoneutron torpedo','torpedo',
				'adventure.php?snarfblat=81','fantasy airship'];
			else if(txt.indexOf("strange shadow") != -1)
				snarf = ['inkwell','inkwell',
				'adventure.php?snarfblat=104','haunted library'];
			else if(txt.indexOf("moonlight reflecting") != -1)
				snarf = ['hair spray','spraycan',
				'store.php?whichstore=m','demon market'];
			else if(txt.indexOf("wooden frame") != -1)
				snarf = ['disease','disease',
				'adventure.php?snarfblat=42','knob harem'];
			else if(txt.indexOf("long coattails") != -1)
				snarf = ['Knob Goblin firecracker','firecrack',
				'adventure.php?snarfblat=114','knob outskirts'];
			else if(txt.indexOf("steam shooting") != -1)
				snarf = ['powdered organs','scpowder',
				'pyramid.php','pyramid'];
			else if(txt.indexOf("holding a spatula") != -1)
				snarf = ['leftovers of indeterminate origin','leftovers',
				'adventure.php?snarfblat=102','haunted kitchen'];
			else if(txt.indexOf("bass guitar") != -1)
				snarf = ['mariachi G-string','string',
				'adventure.php?snarfblat=45','south of the border'];
			else if(txt.indexOf("North Pole") != -1)
				snarf = ['NG','ng',
				'adventure.php?snarfblat=80','valley'];
			else if(txt.indexOf("writing desk") != -1)
				snarf = ['plot hole','hole',
				'adventure.php?snarfblat=82','castle in the sky'];
			else if(txt.indexOf("cuticle") != -1)
				snarf = ['razor-sharp can lid','canlid',
				'adventure.php?snarfblat=113','haunted pantry'];
			else if(txt.indexOf("formidable stinger") != -1)
				snarf = ['tropical orchid','troporchid','shore.php','shore'];
			else if(txt.indexOf("pair of horns") != -1)
				snarf = ['barbed-wire fence','fence','shore.php','shore'];
			else if(txt.indexOf("wooden beam") != -1)
				snarf = ['stick of dynamite','dynamite','shore.php','shore'];

			if (snarf)
			{	var html =
'<div style="width:180px; font-size:12px; margin-left:10px; vertical-align:top; text-align:right; float:right;">' +
'<img style="float:right; margin:0 0 2px 5px;" src="http://images.kingdomofloathing.com/itemimages/'+snarf[1]+'.gif"/>' + 
'<b class="combatitem">' + snarf[0] + '</b><br/><a class="small" href="'+snarf[2]+'" target="mainpane">[' + snarf[3] + ']</a>';
				$(this).before(html+'</div>')
					.after('<div style="clear:both;"></div>');
			}
		});

		GM_get(server + '/inventory.php?which=3', function(txt)
		{	$('b[class=combatitem]').each(function()
			{	if(txt.indexOf('>'+this.innerHTML) != -1)
					this.setAttribute('style','color:green;');
				else this.setAttribute('style','color:red;');
		});	});
}	}

// --------------------------------------------
// BASEMENT: Im in ur base, spoilin ur puzzlez.
// --------------------------------------------
function at_basement()
{	var bq = document.getElementsByTagName('blockquote')[0];
	var ins = document.getElementsByTagName('input');

	// Phial link
	for (var i=0, len=ins.length; i<len; i++)
	{	if (ins[i].type != 'submit') continue;
		var phial = 0; var temp = ins[i].value;
		var curphial = GetData("phial");
		if (temp.indexOf("Drunk's Drink") != -1) phial = 1638;
		else if (temp.indexOf("Pwn the Cone") != -1) phial = 1640;
		else if (temp.indexOf("Hold your nose") != -1) phial = 1641;
		else if (temp.indexOf("Typewriter,") != -1) phial = 1637;
		else if (temp.indexOf("Vamps") != -1) phial = 1639;
		if (phial > 0 && phial != (curphial+1448)) // In the biz, we call this this the Phial Phudge Phactor.
		{	var bq = document.getElementsByTagName('blockquote')[0];
			var aa = document.createElement('a');
			var phnames = {"1637":"Hot","1638":"Cold","1639":"Spooky","1640":"Stench","1641":"Sleaze"};
			aa.innerHTML = "Use " + phnames[phial] + " Phial"; aa.setAttribute('href','#');
			aa.setAttribute('id','usephial'); 
			if (curphial > 0)
				aa.setAttribute('curphial',"/uneffect.php?using=Yep.&pwd=" + pwd + "&whicheffect=" + curphial);
			aa.setAttribute('phial',"/inv_use.php?pwd=" + pwd + "&which=3&whichitem=" + phial);
			aa.addEventListener('click',function(event)
			{	this.innerHTML = "Using Phial...";
				if (this.getAttribute('curphial'))
				GM_get(server + this.getAttribute('curphial'),function(details)
				{	var ph = document.getElementById('usephial');
					if (details.indexOf("Effect removed.") != -1)
					GM_get(server + ph.getAttribute('phial'),function(details2)
					{	var ph = document.getElementById('usephial'); ph.innerHTML = "";
						top.frames[1].location.reload();
				});	});
				else GM_get(server + this.getAttribute('phial'),function(details)
				{	var ph = document.getElementById('usephial'); ph.innerHTML = "";
					top.frames[1].location.reload();
				}); event.stopPropagation(); event.preventDefault();
			}, false);
			var cr = document.createElement('center');
			bq.appendChild(cr); cr.appendChild(aa);
	}	}

	// OMGSPOILERS
	var lvl; var str = ""; var trs = document.getElementsByTagName('tr');
	for (var j=0; j<trs.length; j++)
	{	lvl = document.getElementsByTagName('tr')[j].textContent;
		if (lvl.charAt(0) == "F") break;
	}
	lvl = lvl.substring(lvl.indexOf("Level ")+6, lvl.length);
	var bim = document.images[document.images.length-1];
	var bimg = bim.getAttribute('src');
	bimg = bimg.substring(bimg.lastIndexOf("/")+1, bimg.length);

	switch(bimg)
	{	case "earbeast.gif":
			//str = "Monster Level: " + parseInt(Math.pow(lvl,1.4));
			break;
		case "document.gif": lvl = 4.5*Math.pow(lvl,1.4)+8;
			str = "Hot & Spooky: " + parseInt(lvl*.95) + " to " + parseInt(lvl*1.05) + " Damage";
			break;
		case "coldmarg.gif": lvl = 4.5*Math.pow(lvl,1.4)+8;
			str = "Cold & Sleaze: " + parseInt(lvl*.95) + " to " + parseInt(lvl*1.05) + " Damage";
			break;
		case "fratbong.gif": lvl = 4.5*Math.pow(lvl,1.4)+8;
			str = "Sleaze & Stench: " + parseInt(lvl*.95) + " to " + parseInt(lvl*1.05) + " Damage";
			break;
		case "onnastick.gif": lvl = 4.5*Math.pow(lvl,1.4)+8;
			str = "Stench & Hot: " + parseInt(lvl*.95) + " to " + parseInt(lvl*1.05) + " Damage";
			break;
		case "snowballbat.gif": lvl = 4.5*Math.pow(lvl,1.4)+8;
			str = "Spooky & Cold: " + parseInt(lvl*.95) + " to " + parseInt(lvl*1.05) + " Damage";
			break;
		case "sorority.gif": case "bigbaby.gif":
		case "pooltable.gif": case "goblinaxe.gif": lvl = Math.pow(lvl,1.4);
			str = "Moxie Needed: " + parseInt(lvl*.94) + " to " + parseInt(lvl*1.06);
			break;
		case "mops.gif": case "voodoo.gif": case "darkshards.gif": lvl = Math.pow(lvl,1.4);
			str = "Mysticality Needed: " + parseInt(lvl*.94) + " to " + parseInt(lvl*1.06);
			break;
		case "typewriters.gif": case "bigstatue.gif": case "bigmallet.gif": lvl = Math.pow(lvl,1.4);
			str = "Muscle Needed: " + parseInt(lvl*.94) + " to " + parseInt(lvl*1.06);
			break;
		case "haiku11.gif": lvl = Math.pow(lvl,1.4) * 10;
			str = "HP Needed: " + parseInt(lvl*.94) + " to " + parseInt(lvl*1.06) + "(lowered by DA)";
			break;
		case "powderbox.gif": lvl = Math.pow(lvl,1.4) * 1.67;
			str = "MP Needed: " + parseInt(lvl*.94) + " to " + parseInt(lvl*1.06);
			break;
	}
	if (str != "") bim.parentNode.innerHTML += "<br><span class='small'><b>"+str+"</b></span>";
}


// -------------------------------------
// OTHER ZONES: Display ML on mouseover.
// -------------------------------------
function spoil_manor2()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("sm2_1") != -1) ml = '147-173';
		else if (src.indexOf("sm2_7") != -1) ml = '76-100';
		else if (src.indexOf("sm2_5") != -1) ml = '110';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_manor3() 
{	var msg = null; 
	$('img').each(function()
	{	var ml = null; 
		var src = this.getAttribute('src');
		if (src.indexOf("cellar") != -1) msg = 'ML: 158-168';
		else if (src.indexOf("chambera") != -1) msg = 'ML: 170';
		if (msg) this.setAttribute('title', msg);
});	}

function spoil_beach()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("newbeach9") != -1) ml = '20-25';
		else if (src.indexOf("desert.gif") != -1) ml = '134-142';
		else if (src.indexOf("oasis") != -1) ml = '132-137';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_pyramid() 
{	var msg = null; 
	$('img').each(function()
	{	var ml = null; 
		var src = this.getAttribute('src');
		if (src.indexOf("mid2") != -1) msg = 'ML: 162-176';
		else if (src.indexOf("mid3b") != -1) msg = 'ML: 162-180';
		else if (src.indexOf("mid4_5") != -1) msg = 'Keep Going...';
		else if (src.indexOf("mid4_2") != -1) msg = 'Keep Going...';
		else if (src.indexOf("mid4_4") != -1) msg = 'Phase 1: Token';
		else if (src.indexOf("mid4_3") != -1) msg = 'Phase 2: ???';
		else if (src.indexOf("mid4_1.") != -1) msg = 'Phase 3: Profit!';
		if(msg) this.setAttribute('title', msg);
});	}

function spoil_bathole()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("batrat") != -1) ml = '23-25';
		else if (src.indexOf("batentry") != -1) ml = '11-16';
		else if (src.indexOf("junction") != -1) ml = '14-18';
		else if (src.indexOf("batbean") != -1) ml = '22';
		else if (src.indexOf("batboss") != -1) ml = '26-35';
		else if (src.indexOf("batrock") != -1)
			this.parentNode.href = "inv_use.php?pwd=" + pwd + "&which=3&whichitem=563";
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_plains()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("knob1") != -1) ml = '1-2';
		else if (src.indexOf("funhouse") != -1) ml = '14-20';
		else if (src.indexOf("knoll1") != -1) ml = '10-13';
		else if (src.indexOf("cemetary") != -1) ml = '18-20 / 53-59';
		else if (src.indexOf("palindome") != -1) ml = '116-135';
		else if (src.indexOf("garbagegrounds") != -1)
		{	$(this).wrap('<a href="inv_use.php?pwd=' + pwd +
				'&which=3&whichitem=186" border="0"></a>');
		} if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_knob()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("knob3") != -1) ml = '1-2';
		else if (src.indexOf("knob4") != -1) ml = '20-22';
		else if (src.indexOf("knob6") != -1) ml = '24-32';
		else if (src.indexOf("knob7") != -1) ml = '26-32';
		else if (src.indexOf("knob9") != -1) ml = '57';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_knob2()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("knob22") != -1) ml = '40-45';
		else if (src.indexOf("knob23") != -1) ml = '50-56';
		else if (src.indexOf("knob26") != -1) ml = '60-66';
		else if (src.indexOf("knob29") != -1) ml = '70-76';
		else if (src.indexOf("shaft2") != -1) ml = '30';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_cyrpt()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("cyrpt4d") != -1) ml = '53-59 / 79';
		else if (src.indexOf("cyrpt6d") != -1) ml = '57-58 / 77';
		else if (src.indexOf("cyrpt7d") != -1) ml = '54-58 / 77';
		else if (src.indexOf("cyrpt9d") != -1) ml = '54 / 79';
		else if (src.indexOf("cyrpt2") != -1) ml = '91';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_woods()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("8bitdoor") != -1) ml = '20-25';
		else if (src.indexOf("kforest") != -1) ml = '123-133';
		else if (src.indexOf("hiddencity") != -1) ml = '145-156';
		else if (src.indexOf("forest") != -1) ml = '5';
		else if (src.indexOf("barrow") != -1) ml = '56-65';
		else if (src.indexOf("pen.") != -1) ml = '13-20';
		else if (src.indexOf("grove") != -1) ml = '34-36';
		else if (src.indexOf("tavern") != -1) ml = '10';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_island()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("island4") != -1) ml = '39-41';
		else if (src.indexOf("island6") != -1) ml = '39-41';
		else if (src.indexOf("cove") != -1) ml = '61-69';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_cove()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("cove3_2x1") != -1) ml = '80-83';
		else if (src.indexOf("cove3_3x1b") != -1) ml = '100';
		else if (src.indexOf("cove3_3x3b") != -1) ml = '120';
		else if (src.indexOf("cove3_5x2b") != -1) ml = '140';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_dungeons()
{	$('img[src*=ddoom]').attr('title','ML: 36-45');		// dungeon of doom
	$('img[src*=dungeon.gif').attr('title','ML: 3-4');	// haiku dungeon--now with combats!
	$('img[src*=dungeon2.gif').attr('title','ML: 12-20');	// daily dungeon
}

function spoil_friars()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("neck") != -1) ml = '40-52';
		else if (src.indexOf("heart") != -1) ml = '42-50';
		else if (src.indexOf("elbow") != -1) ml = '44-48';
		else if (src.indexOf("stones") != -1) ml = '40-52';		// post-Azazel
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_beanstalk()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("hole") != -1) ml = '151-169';
		else if (src.indexOf("castle") != -1) ml = '125-146';
		else if (src.indexOf("airship") != -1) ml = '91-120';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_fernruin()
{	$('img[src*=ruins_5]').attr('title','ML: 16-24');
}

function spoil_lair3()
{	var hedge = $('img[src*=hedgemaze.gif]');
	if(hedge.length>0)
	{	hedge.attr('title','ML: 232');
		$('img[src*=castletoptower.gif]')
			.before(AppendLink('[hedge puzzle]', 'hedgepuzzle.php'))
			.before('<br /><br />')
			.parent().attr('style','text-align:center;');
}	}

function spoil_mountains()
{	$("img[src*=valley2]").attr('title','ML: 75-87');
	$("img[src*=bigbarrel]").attr('title','ML: 15/25/35');
}

function spoil_mclargehuge()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("omright") != -1) ml = '53-57';
		else if (src.indexOf("ommid") != -1) ml = '68';
		else if (src.indexOf("rightmid") != -1) ml = '71-76';
		else if (src.indexOf("leftmid") != -1) ml = '70-90';
		else if (src.indexOf("top") != -1) ml = '105-107';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_canadia()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("olcamp") != -1) ml = '2-3';
		else if (src.indexOf("lcamp") != -1) ml = '35-40';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_cave()			// dark and dank and sinister cave, that is...
{	$('img[src*=chamberbottom]').attr('title','ML: 20-25');
	$('img[src*=chamber_door]').attr('title','ML: 27');
}

function spoil_bigisland()
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		if (src.indexOf("nunnery1") != -1) ml = 'ML: 168';
		else if (src.indexOf("bfleft") != -1) ml = this.getAttribute('title') + ' (ML: 170-210)'; // don't overwrite image number info
		else if (src.indexOf("bfright") != -1) ml = this.getAttribute('title') + ' (ML: 170-210)';
		else if (src.indexOf("junk1") != -1) ml = 'ML: 168-172';
		else if (src.indexOf("junk3") != -1) ml = 'ML: 168-172';
		else if (src.indexOf("junk5") != -1) ml = 'ML: 168-172';
		else if (src.indexOf("junk7") != -1) ml = 'ML: 168-172';
		else if (src.indexOf("filth4") != -1) ml = 'ML: 165';
		else if (src.indexOf("filth6") != -1) ml = 'ML: 167';
		else if (src.indexOf("filth8") != -1) ml = 'ML: 169';
		else if (src.indexOf("filth9") != -1) ml = 'ML: 173';
		else if (src.indexOf("farm1d") != -1) ml = 'ML: 170-179, cold (weak=hot/spooky)';
		else if (src.indexOf("farm2d") != -1) ml = 'ML: 170-177, hot (weak=stench/sleaze)';
		else if (src.indexOf("farm3d") != -1) ml = 'ML: 173, sleaze (weak=cold/spooky)';
		else if (src.indexOf("farm4d") != -1) ml = 'ML: 175 (no elemental alignment)';
		else if (src.indexOf("farm5d") != -1) ml = 'ML: 166-168';
		else if (src.indexOf("farm6d") != -1) ml = 'ML: 169-174, stench (weak=cold/sleaze)';
		else if (src.indexOf("farm7d") != -1) ml = 'ML: 171-175, spooky (weak=hot/stench)';
		// farm8 is McMillicancuddy, he's never an adventurable zone
		else if (src.indexOf("farm9d") != -1) ml = 'ML: 165-180 (no elemental alignment)';
		else if (src.indexOf("bmim24") != -1) ml = 'ML: 240-250';		// wrong section?  hippy camp, bombed.
		else if (src.indexOf("bmim23") != -1) ml = 'ML: 230-255';		// wrong section?  frat house, bombed.
		else if (src.indexOf("lighthouse_left") != -1) ml = 'ML: 171';
		
		if(ml) this.setAttribute('title',ml);
});	}

function spoil_postwarisland()		
{	$('img').each(function()
	{	var ml = null; var src = this.getAttribute('src');
		// Note to wiki peoples: more spoilers, plz
		if (src.indexOf("nunnery1") != -1) ml = '168';
		else if (src.indexOf("22.gif") != -1) ml = '61-69';		// pirate cove, undisguised
		else if (src.indexOf("23.gif") != -1) ml = '39-41';		// hippy camp, unbombed
		else if (src.indexOf("24.gif") != -1) ml = '240-250'; 	// hippy camp, bombed
		else if (src.indexOf("25.gif") != -1) ml = '169-172';	// Junkyard
		else if (src.indexOf("26.gif") != -1) ml = '169-180';	// McMillicancuddy
		else if (src.indexOf("27.gif") != -1) ml = '39-41'; 	// frathouse, unbombed 
		else if (src.indexOf("28.gif") != -1) ml = '230-255'; 	// frathouse, bombed
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_thesea()
{	$('img').each(function()
	{	var ml= null; var src = this.getAttribute('src');
		if (src.indexOf("sea1") != 1) ml = '300-330';		// briny
		if (src.indexOf("sea2") != 1) ml = '350-400';		// brinier
		if (src.indexOf("sea3") != 1) ml = '375-425';		// briniest
//		if (src.indexOf("") != 1) ml = '';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}

function spoil_seafloor()
{	$('img').each(function()
	{	var ml= null; var src = this.getAttribute('src');
		if (src.indexOf("garden") != 1) ml = '350-450';			// octopus's garden
		if (src.indexOf("divebar") != 1) ml = '400-600';		// dive bar
		if (src.indexOf("mine") != 1) ml = '400-500';			// anemone mine
		if (src.indexOf("trench") != 1) ml = '400-550';			// marinara trench
		if (src.indexOf("utpost") != 1) ml = '650-750';			// mer-kin outpost
		if (src.indexOf("shipwreck") != 1) ml = '400-700';		// Fitzsimmons
		if (src.indexOf("reef") != 1) ml = '400-500';			// Madness Reef
//		if (src.indexOf("") != 1) ml = '';
		if(ml) this.setAttribute('title','ML: '+ml);
});	}		

function spoil_wormwood()
{	$('img').each(function()
	{	var ml= null; var src = this.getAttribute('src');
		if (src.indexOf("wormwood3") != -1) ml = '9-7 for skirt, STLT, myst; 5-4 for !pipe, necklace, moxie; 1 for flask, mask, muscle'; // Mansion 
		if (src.indexOf("wormwood4") != -1) ml = '9-7 for mask, !pipe, muscle; 5-4 for skirt, flask, myst; 1 for STLT, necklace, moxie'; // dome
		if (src.indexOf("wormwood8") != -1) ml = '9-7 for necklace, flask, moxie; 5-4 for mask, STLT, muscle; 1 for skirt, !pipe, myst'; // windmill
		if (ml) this.setAttribute('title',ml);
});	}

// -------------------------
// MTNOOB: Open letter! Yay!
// -------------------------
function at_mtnoob()
{	if (location.search.indexOf("toot") == -1) return;
	$('b:contains(Ralph)').append(
		AppendLink('[read]', 'inv_use.php?pwd='+
		pwd + '&which=3&whichitem=1155'));
}

//function at_showplayer()
//{	if (location.search != "?who=53596" && location.search != "?who=73736")
//		return;
//	var img = document.getElementsByTagName('img'); for (var i=50, len=img.length; i<len; i++)
//	{	var temp = img[i]; if (temp.width == 100 && temp.title.indexOf("Tiny") != -1)
//		{	var nu = document.createElement('img'); nu.title = "Worst. Trophy. Ever.";
//			nu.src = "http://images.kingdomofloathing.com/otherimages/trophy/not_wearing_any_pants.gif";
//			temp.parentNode.insertBefore(nu,temp.nextSibling); break;
//}	}	}

// ---------------------------------------------------
// DESC_ITEM: Add use boxes/links to item descriptions
// ---------------------------------------------------
function at_desc_item() {
  linkKOLWiki();
}

function at_desc_effect() {
  linkKOLWiki();
}

function linkKOLWiki() {
  var b = $('b:first');
  b.wrap('<a href="http://kol.coldfront.net/thekolwiki/index.php/'+
	 'Special:Search?search='+ b.text().replace(/\s/g, '+') +'&go=Go" '+
	 'target="_blank"></a>');
}

// --------------------------------------------
// TOPMENU: Add some new links to the top pane.
// --------------------------------------------
function at_topmenu()
{
// moonslink script cheerfully borrowed from Beingeaten
	if(GetPref('moonslink')== 1) {
		var moons = $('img[src*=moon]');
		var calendarURL = 'http://noblesse-oblige.org/calendar/';
		var moonlink = document.createElement('a');
		moonlink.setAttribute('target','_blank');
		moonlink.setAttribute('href', calendarURL);
		moons.attr('border',0);
		moons.wrap(moonlink); 
	}
//end moonslink

	// some housekeeping stuff that I want to make sure gets checked regularly and can't think of a better place for...
	// gotta clear these out when you ascend, which you may do on a different computer occasionally.
	if (parseInt(GetData('level')) < 11) {
		SetCharData("corner178",0);
		SetCharData("corner179",0);
		SetCharData("corner180",0);
		SetCharData("corner181",0);
		SetCharData("winelist",'');
		SetCharData("wineHTML",'');
		SetCharData("winesNeeded",'');
		SetCharData("altar1",'');
		SetCharData("altar2",'');
		SetCharData("altar3",'');
		SetCharData("altar4",'');
	}
	var compactmode = document.getElementsByName('loc').length; // compact mode has a dropdown listbox called 'loc', full mode doesn't.
	if (compactmode > 0) {	
		at_compactmenu();
		return;
	}
	// Test if quickskills is present. TODO: Find a cleaner way to do this.
	var quickSkills = 0, moveqs = 0;
	if ($('center:first').html().indexOf("javascript:skillsoff();") != -1)
	{	quickSkills = 1; moveqs = GetPref('moveqs');
	}

	// Set defaults if needed
	Defaults(0);

	var toprow1 = 0, toprow2, toprow3, front;
	var shorttop = 0, haveLair = 0, weBuildHere;
	if (GetPref('shortlinks') % 2 > 0)
	{	shorttop = 1;
		toprow1 = document.createElement('span');
		toprow2 = document.createElement('span');
		front = GetPref('toprow');
	}

	// Find all links and attach event handlers
	$('a').each(function(ind)
	{	var a = $(this);
		var txt = a.text();

		// prefs
		var splitinv = GetPref('splitinv');
		var splitquest = GetPref('splitquest');
		var splitmsg = GetPref('splitmsg');
		var logoutconf = GetPref('logout');

		// Map / Skills links
		if (ind == 0 && quickSkills == 1 && moveqs > 0)
			a.parent().attr('style','display:none;');


		// Yes I know this link only applies to a handful of people. I'm doing it anyway.
		if (txt == "devster panel") a.html("devster");
		
		// shorten things up to make some room for our other additions
		if (txt == "campground") a.html("camp");
		if (txt == "mountains") a.html("mtns");

		// Lair
		if (txt == "lair") haveLair = 1;

		// Confirm logout
		if (txt == "log out" && logoutconf == 1)
		{	a.after('<a href="javascript:void(0);" onclick="this.' +
'previousSibling.innerHTML=\'logout\'; this.innerHTML=\'\';"></a>');
			a.replaceWith('<a target="_top" href="logout.php" ' +
'onclick="if(this.innerHTML!=\'sure?\') { this.blur(); ' +
'this.innerHTML=\'sure?\'; this.nextSibling.' +
'innerHTML=\' (nope)\'; return false; }">log out</a>');
		}

		if (txt == "plains")
		{	a.after(' <a href="manor.php" target="mainpane">manor</a>');

			if (parseInt(GetData('level')) > 9)
				a.after(' <a href="beanstalk.php" target="mainpane">stalk</a>');

			// This is as good a place as any; get span for adding links later.
			weBuildHere = a.parent().get(0);
			weBuildHere.parentNode.setAttribute('nowrap','nowrap');
		}
		
		if (txt == "beach")
		{	if (parseInt(GetData('level')) > 12) 
			a.after(' <a href="thesea.php" target="mainpane">sea</a>');
		}
		
		if (txt == "town")
		{
			a.html("town:");
			a.after(' <a href="dungeons.php" target="mainpane">dungeons)</a>');
			a.after(' <a href="town_right.php" target="mainpane">R</a>');
			a.after(' <a href="town_wrong.php" target="mainpane">(W</a>');
		}

		// Remove last row, which will be manually re-added.
		if (shorttop)
		{	if (txt == "documentation" || txt == "report bug"
			||  txt == "store" ||  txt == "donate" ||  txt == "forums")
			{	a.html("");
				a.get(0).nextSibling.textContent = "";
			} if(txt.indexOf("radio") != -1) a.html("");
		}

		// Inventory
		if (txt == "inventory" && splitinv == 1)
		{	a.html('ory').attr('href','inventory.php?which=3')
				.before('<a href="inventory.php?which=1" '+
					'target="mainpane">inv</a>')
				.before('<a href="inventory.php?which=2" ' +
					'target="mainpane">ent</a>');
			a.after(' <a href="inventory.php?which=4" target="mainpane">fav</a>');	// 21Dec09 Hellion: added favorites link.
		}

		// Quests
		if (txt == "quests" && splitquest == 1)
		{	a.html('sts').attr('href','questlog.php?which=4')
				.before('<a href="questlog.php?which=1" '+
					'target="mainpane">que</a>');
		}

		// Messages
		if (txt == "messages" && splitmsg > 0)
		{	switch (splitmsg)
			{	case 2: a.attr('href','messages.php?box=Outbox'); break;
				case 3: a.attr('href','messages.php?box=Saved'); break;
				case 4: a.attr('href','messages.php?box=PvP'); break;
				default: a.attr('href','sendmessage.php');
			}
			a.html('ages').before('<a href="messages.php" ' +
				'target="mainpane">mess</a>');
		}

		// Ass-metric link. Surround it in a named span for easy hiding.
		if (moveqs > 0 && txt == "Asymmetric Publications, LLC")
		{	a.parent().wrapAll('<span name="assy" id="menus"></span>');
		}
	});

	// Attach skills link to Sword and Martini Guy
	var swordGuy = $('img:first[src*=smallleft]');
	var swordGuyURL = GetPref('swordguy');
	if (swordGuyURL != '' && swordGuy.length > 0)
	{	var guy = document.createElement('a');
		if (swordGuyURL.indexOf("http://") != -1)
			guy.setAttribute('target','_blank');
		else guy.setAttribute('target','mainpane');
		guy.setAttribute('href', swordGuyURL);
		swordGuy.attr('border',0);
		swordGuy.wrap(guy);

		swordGuy.get(0).addEventListener('contextmenu', function(event)
		{	var nuhref = prompt('Where would you like this link to point?',
				GetPref('swordguy'));
			var ln = this.parentNode;
			if(nuhref)
			{	SetPref('swordguy', nuhref);
				swordGuy = nuhref;
			}
			ln.setAttribute('href', nuhref);
			if (nuhref.indexOf("http://") != -1)
				ln.setAttribute('target','_blank');
			else ln.setAttribute('target','mainpane');
			event.preventDefault(); event.stopPropagation();
			return false;
		}, false);

		swordGuy = swordGuy.parent().get(0); // For use later
	}

	// Add rows of links
	if (shorttop)
	{	var a;

		toprow1.setAttribute("name","toprow1");
		if (front != 1) toprow1.setAttribute("style","display: none;");

		for (var j=0; j<10; j++)
		{	var zoiks = GetPref('menu1link'+j); var tarjay = 'mainpane';
			var zplit = zoiks.split(';');
			if (zplit[0] == "guildstore")
			{	AddTopLink(toprow1, 'mainpane', 'fnord', '', 1);
				AddTopLink(toprow1, 'mainpane', 'smeg', '', 1);
				GM_get(server+'/store.php?whichstore=2', function(t)
				{	if(t.length>10 && t.indexOf('Only Pastamancers') == -1)
						$('a[href=fnord]')
						.attr('href', 'store.php?whichstore=2')
						.html('gouda');
				});
				GM_get(server+'/store.php?whichstore=3', function(t)
				{	if(t.length>10 && t.indexOf('Only Seal C') == -1)
						$('a[href=smeg]')
						.attr('href', 'store.php?whichstore=3')
						.html('smack');
				})

			} else if (zoiks != "")
			{	if (zoiks.indexOf("http://") != -1) tarjay = '_blank';
				AddTopLink(toprow1, tarjay, zplit[1], zplit[0], 1);
			} else break;
		}

		toprow1.appendChild(document.createElement('br'));
		var poop = document.createElement('span'); poop.innerHTML = "&nbsp;";
		toprow1.appendChild(poop);
		AddTopLink(toprow1, 'mainpane', 'multiuse.php', 'multi-use', 1);
		AddTopLink(toprow1, 'mainpane', 'craft.php?mode=combine', 'combine', 1);
		AddTopLink(toprow1, 'mainpane', 'sellstuff.php', 'sell', 1);
		AddTopLink(toprow1, 'mainpane', 'craft.php?mode=cook', 'cook', 1);
		AddTopLink(toprow1, 'mainpane', 'craft.php?mode=cocktail', 'mix', 1);
		AddTopLink(toprow1, 'mainpane', 'craft.php?mode=smith', 'smith', 1);
		AddTopLink(toprow1, 'mainpane', 'council.php', 'council', 1);
		AddTopLink(toprow1, 'mainpane', 'guild.php', 'guild', 1);
		if (haveLair == 1 && parseInt(GetData('level')) == 13)
			AddTopLink(toprow1, 'mainpane', 'lair2.php?action=door', 'door', 1);
		a = document.createElement('a'); a.innerHTML = "more"; a.setAttribute('href','#');
		a.addEventListener('click', function(event)
		{	var tr1 = document.getElementsByName("toprow1")[0];
			var tr2 = document.getElementsByName("toprow2")[0];
			tr1.style.display = "none"; tr2.style.display = "inline";
			SetPref('toprow', 2);
		}, true); toprow1.appendChild(a);

		toprow2.setAttribute("name","toprow2");
		if (front != 2) toprow2.setAttribute("style","display: none;");

		for (var j=0; j<10; j++)
		{	var zoiks = GetPref('menu2link'+j); var tarjay = 'mainpane';
			if (zoiks != "")
			{	if (zoiks.indexOf("http://") != -1 || zoiks.indexOf("searchplayer") != -1) tarjay = '_blank';
				AddTopLink(toprow2, tarjay, zoiks.split(';')[1], zoiks.split(';')[0], 1);
			} else break;
		}

		toprow2.appendChild(document.createElement('br'));
		AddTopLink(toprow2, 'mainpane', 'doc.php?topic=home', 'documentation', 1);
		AddTopLink(toprow2, 'mainpane', 'adminmail.php', 'report bug', 1);
		AddTopLink(toprow2, '_blank', 'http://store.asymmetric.net', 'store', 1);
		AddTopLink(toprow2, '_blank', 'donatepopup.php', 'donate', 1);
		AddTopLink(toprow2, '_blank', 'http://forums.kingdomofloathing.com', 'forums', 1);
		AddTopLink(toprow2, '_blank', 'radio.php', 'radio', 1);
		a = document.createElement('a'); a.innerHTML = "more"; a.setAttribute('href','#');
		a.addEventListener('click', function(event)
		{	var tr2 = document.getElementsByName("toprow2")[0];
			var tr1 = document.getElementsByName("toprow1")[0];
			tr2.style.display = "none"; tr1.style.display = "inline";
			SetPref('toprow', 1);
		}, true); toprow2.appendChild(a);

		// Actually add the stuffy-stuff to the span we grabbed earlier
		weBuildHere.appendChild(toprow1);
		weBuildHere.appendChild(toprow2);

		GoGoGadgetPlunger();
	}

	// Move Quick-Skills
	if (moveqs > 0)
	{	weBuildHere.setAttribute('id','menus2');
		var assy = document.getElementsByName('assy')[0];
		var iframe = document.getElementsByName('skillpane')[0];
		iframe.removeAttribute('style');
		assy.setAttribute('style','display: none;');
		if (moveqs == 1)
		{	var tr = document.getElementsByTagName('tr')[0];
			tr.insertBefore(assy.parentNode, swordGuy.parentNode);
		} assy.parentNode.appendChild(iframe.parentNode);
		iframe.parentNode.parentNode.setAttribute('style', 'padding-top: 2px;');
//		iframe.parentNode.parentNode.setAttribute('style', 'padding-top: 4px; width: 300px;');
		//iframe.setAttribute('width', 300);
		// I'm open to suggestions on a better way to do this. EDIT: this, maybe?
		document.location = document.links[1];
		//iframe.contentWindow.setTimeout('self.location = "skills.php?tiny=1";',200);
	}
}

function at_ascend()
{
	var checklist = GetPref('ascension_list');
	if (checklist != '') {
		checklist = checklist.replace(/,/g,"<br>");
		checklist = "<center><b>Checklist:</b><br>" + checklist + "</center>";
		var clDisplay = document.createElement('div');
		clDisplay.innerHTML = checklist;
		document.body.appendChild(clDisplay);
	}
}

// --------------------------------------------
// COMPACTMENU: Add options to menus and stuff.
// --------------------------------------------
function at_compactmenu()
{
	var selectItem, links, oonTD, linkTD;
	var quickSkills = 0, moveqs = 0;

	// Set defaults if needed
	Defaults(0);

	moveqs = GetPref('moveqs');
	links = document.getElementsByTagName('a');
	for (var i=0, len=links.length; i<len; i++)
	{	var temp = links[i];

		if (temp.text.indexOf("menu") != -1)
		{	quickSkills = 1;
			if (moveqs > 0)
			{	temp.innerHTML = "";
				linkTD = temp.parentNode;
		}	}

		if (temp.innerHTML.indexOf("20") != -1)
		{	if (moveqs > 0 && quickSkills > 0)
			{	oonTD = temp.parentNode;
				temp.innerHTML = '';

				var iframe = document.getElementsByName('skillpane')[0];
				var menuspan = document.getElementsByName('menus')[0];
				linkTD.nextSibling.childNodes[1].setAttribute('id','menus2');
				linkTD.nextSibling.setAttribute('style','width:100%;');
				oonTD.appendChild(iframe.parentNode);
				if (moveqs == 1) // Left
					linkTD.parentNode.insertBefore(oonTD, linkTD.nextSibling);
				else // Right
					oonTD.parentNode.insertBefore(linkTD, oonTD);

				// Remove Moons label. Sneakily.
				temp = document.getElementsByTagName('b')[0];
				if (temp.innerHTML.indexOf('Moons') != -1)
				{	var umspan = document.createElement('span');
					temp.parentNode.setAttribute('style','display:none;');
					umspan.setAttribute('id','menus');
					temp.parentNode.appendChild(umspan);
					umspan.appendChild(temp);
				}
				iframe.contentWindow.setTimeout('self.location = "skills.php?tiny=1";',50);
		}	}
	}

	// Camera One!
	if (GetPref('shortlinks') % 2 > 0 || GetPref('splitinv') == 1)
	{	selectItem = document.getElementsByTagName('select')[0];
		//selectItem.setAttribute('style','font-size: 9pt;');
		selectItem.parentNode.parentNode.setAttribute('nowrap','nowrap');
		for (i=0; i<selectItem.options.length; i++)
		{	if (GetPref('splitinv') == 1 && selectItem.options[i].innerHTML == "Inventory")
			{	selectItem.options[i].innerHTML = "Consumables";
				selectItem.options[i].value = "inventory.php?which=1";
				AddTopOption("Equipment", "inventory.php?which=2", selectItem, selectItem.options[i+1]);
				AddTopOption("Miscellaneous", "inventory.php?which=3", selectItem, selectItem.options[i+2]);
				AddTopOption("Favorites","inventory.php?which=4",selectItem,selectItem.options[i+3]);
				if (GetPref('shortlinks') % 2 == 0) break;
			}
// if splitquest pref is set, make Quests go to Current Quests and add a Notes entry.
// otherwise Quests always goes to the Notes page.
			if (selectItem.options[i].innerHTML == "Quests")
			{	if (GetPref('splitquest')) {
					AddTopOption("Notes","questlog.php?which=4", selectItem, selectItem.options[i+1]);
					selectItem.options[i].value="questlog.php?which=1";
				}
				else selectItem.options[i].value="questlog.php?which=4";
			}
			if (selectItem.options[i].innerHTML == "Account Menu")
			{	AddTopOption("-", "nothing", selectItem, selectItem.options[i+1]);
				AddTopOption("Multi-Use", "multiuse.php", selectItem, selectItem.options[i+2]);
				AddTopOption("Combine", "craft.php?mode=combine", selectItem, selectItem.options[i+3]);
				AddTopOption("Sell Items", "sellstuff.php", selectItem, selectItem.options[i+4]);
				AddTopOption("Cook Food", "craft.php?mode=cook", selectItem, selectItem.options[i+5]);
				AddTopOption("Mix Drinks", "craft.php?mode=cocktail", selectItem, selectItem.options[i+6]);
				AddTopOption("Smith/Smash", "craft.php?mode=smith", selectItem, selectItem.options[i+7]);
				AddTopOption("Closet", "closet.php", selectItem, selectItem.options[i+8]);
				AddTopOption("-", "nothing", selectItem, selectItem.options[i+9]);
				GM_get(server + "/knoll.php",function(response)
				{	if (response == "") return;
					var s = document.getElementsByTagName('select')[0];
					for (var i=0; i<s.options.length; i++)
					{	if (s.options[i].value == "craft.php?mode=combine")
						{	s.options[i].value = "knoll.php?place=paster"; break;
				}	}	});
			}
			if (GetPref('logout') == 1 && selectItem.options[i].innerHTML == "Log Out")
			{	selectItem.options[i].value = "logout";
				selectItem.setAttribute('onchange', 'if (document.navform1.loc.value!="logout") goloc(); ' +
					'else if (confirm("Log out?")) parent.frames[2].location = "logout.php"; ' +
					'else this.selectedIndex=0;');
			}
	}	}

	// Camera Two!
	if (GetPref('shortlinks') % 2 > 0)
	{	selectItem = document.getElementsByTagName('select')[1];
		selectItem.parentNode.parentNode.setAttribute('nowrap','nowrap');
		for (var i=0, len = selectItem.options.length; i<len; i++)
		{	if (selectItem.options[i].innerHTML.indexOf("Nearby Plains") != -1)
			{	AddTopOption("The Beanstalk", "beanstalk.php", selectItem, selectItem.options[i+1]);
				AddTopOption("Spookyraven Manor", "manor.php", selectItem, selectItem.options[i+2]);
				len += 2;	// extend loop to cover new options just added.
			}	
			if (selectItem.options[i].innerHTML.indexOf("Seaside Town") != -1)
			{
				AddTopOption("Town: Wrong side","town_wrong.php", selectItem, selectItem.options[i+1]);
				AddTopOption("Town: Right side","town_right.php", selectItem, selectItem.options[i+2]);
				AddTopOption("Town: Dungeons","dungeons.php", selectItem, selectItem.options[i+3]);
				len += 3;
			}
			if (selectItem.options[i].innerHTML.indexOf("Desert Beach") != -1)
			{	if (parseInt(GetData('level')) > 12) 
				{	AddTopOption("The Sea","thesea.php",selectItem, selectItem.options[i+1]);
					// len++;
				}
			}
		}

		AddTopOption("-", "nothing", selectItem, 0);
		AddTopOption("Council of Loathing", "council.php", selectItem, 0);
		AddTopOption("Class Guild", "guild.php", selectItem, 0);
		AddTopOption("Market Square", "town_market.php", selectItem, 0);
		AddTopOption("Hermitage", "hermit.php", selectItem, 0);
		AddTopOption("Untinker", "town_right.php?place=untinker", selectItem, 0);
		AddTopOption("Mystic Crackpot", "mystic.php", selectItem, 0);
		AddTopOption("Bounty Hunter", "bhh.php", selectItem, 0);
		AddTopOption("Gouda's Grocery", "store.php?whichstore=2", selectItem, 0);
		AddTopOption("Smacketeria", "store.php?whichstore=3", selectItem, 0);
		AddTopOption("Demon Market", "store.php?whichstore=m", selectItem, 0);
		AddTopOption("Doc Galaktik", "galaktik.php", selectItem, 0);
		AddTopOption("Laboratory", "store.php?whichstore=g", selectItem, 0);
		AddTopOption("Hippy Store", "store.php?whichstore=h", selectItem, 0);
		AddTopOption("Display Case", "managecollection.php", selectItem, 0);
		AddTopOption("Hagnk","storage.php",selectItem,0);
	}
}

// -------------------------------------
// ACCOUNT: Preference-Type Thing-Thing.
// -------------------------------------
function at_account()
{	Defaults(0);
	var tables = document.getElementsByTagName('table');
	for (var i=0; i < tables.length; i++)
	{	if (tables[i].rows[0].textContent == "Interface Options")
		{	var choice, select;
			var bigSpan = document.createElement('span');
			var prefSpan = document.createElement('span');
			bigSpan.setAttribute('id','scriptpref');
			bigSpan.setAttribute('style','display: none');
			bigSpan.appendChild(document.createElement('hr'));

			var spanSpan = document.createElement('span');
			var clicky1 = 'javascript:getObj("scriptpref1").setAttribute("style","");' +
			'javascript:getObj("scriptpref2").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref3").setAttribute("style","display:none;");';
			var clicky2 = 'javascript:getObj("scriptpref1").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref2").setAttribute("style","");' +
			'javascript:getObj("scriptpref3").setAttribute("style","display:none;");';
			var clicky3 = 'javascript:getObj("scriptpref1").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref2").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref3").setAttribute("style","");';
			var clicky4 = 'javascript:getObj("scriptpref1").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref2").setAttribute("style","display:none;");' +
			'javascript:getObj("scriptpref3").setAttribute("style","display:none;");';
			spanSpan.innerHTML = "Toggles: <a href='" + clicky1 +
			"'>[tweak]</a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Customize Links: " +
			"<a href='" + clicky2 + "'>[one]</a> - <a href='" + clicky3 + "'>[two]</a>";
			spanSpan.setAttribute('style','font-size:12px;text-align:center;');
			bigSpan.appendChild(spanSpan);
			bigSpan.appendChild(document.createElement('hr'));

			prefSpan.setAttribute('id','scriptpref1');
			bigSpan.appendChild(prefSpan);

			choice = MakeOption("Clicking Number Boxes: ", 3, 'autoclear', "Does Zilch", "Clears");
			select = choice.firstChild.cells[1].firstChild;
			select.options[2].innerHTML = "Highlights";
			prefSpan.appendChild(choice);

			choice = MakeOption("Max HP/MP Calculation: ", 3, 'safemax', "Average", "Safe");
			select = choice.firstChild.cells[1].firstChild;
			select.options[2].innerHTML = "Really Safe";
			prefSpan.appendChild(choice);

			choice = MakeOption("Extra Shortcut Links: ", 4, 'shortlinks', "Off", "Top Only");
			select = choice.firstChild.cells[1].firstChild;
			select.options[2].innerHTML = "Main Only";
			select.options[3].innerHTML = "On";
			prefSpan.appendChild(choice);

			choice = MakeOption("Omnipresent Quick-Skills: ", 3, 'moveqs', "Off", "On (Left)");
			select = choice.firstChild.cells[1].firstChild;
			select.options[2].innerHTML = "On (Right)";
			prefSpan.appendChild(choice);

			prefSpan.appendChild(MakeOption("Quick-Equip: ", 2, 'quickequip', "Off", "On"));
			prefSpan.appendChild(MakeOption("Split Inventory Link: ", 2, 'splitinv', "Off", "On"));
			prefSpan.appendChild(MakeOption("Split Quest Link: ", 2, 'splitquest', "Off", "On"));
			choice = MakeOption("Split Messages Link: ", 5, 'splitmsg', "Off", "New Message");
			select = choice.firstChild.cells[1].firstChild;
			select.options[2].innerHTML = "Outbox";
			select.options[3].innerHTML = "Saved";
			select.options[4].innerHTML = "PvP";
			prefSpan.appendChild(choice);

			prefSpan.appendChild(MakeOption("Monster Level Spoiler: ", 2, 'zonespoil', "Off", "On"));
			prefSpan.appendChild(MakeOption("Never Grey Out Skills: ", 2, 'nodisable', "Off", "On"));
			prefSpan.appendChild(MakeOption("1-Klick Klaw: ", 2, 'klaw', "Off", "On"));
			prefSpan.appendChild(MakeOption("Logout Confirmation: ", 2, 'logout', "Off", "On"));
			prefSpan.appendChild(MakeOption("Telescope Spoilers: ", 2, 'telescope', "Off", "On"));
//			prefSpan.appendChild(MakeOption("Eat/Drink Again: ", 2, 'eatagain', "Off", "On"));
			prefSpan.appendChild(MakeOption("Lair Spoilers: ", 2, 'lairspoil', "Off", "On"));
			prefSpan.appendChild(MakeOption("Moons link to NO Calendar: ", 2, 'moonslink', "Off", "On"));
			prefSpan.appendChild(MakeOption("Sword-Guy Link: ", -1, 'swordguy', 0, 0));
			prefSpan.appendChild(MakeOption("Backup Outfit Name: ", -1, 'backup', 0, 0));
			prefSpan.appendChild(MakeOption("Ascension Checklist: ", -1, 'ascension_list', 0, 0));

			var menu1Span = document.createElement('span');
			var menu2Span = document.createElement('span');
			menu1Span.setAttribute('id','scriptpref2');
			menu1Span.setAttribute('style','display: none');
			menu2Span.setAttribute('id','scriptpref3');
			menu2Span.setAttribute('style','display: none');

			// Customized Links, Take 1
			for (var j=0; j<10; j++)
			{	var menutxt = GetPref('menu1link'+j);
				if (menutxt != undefined) menutxt = menutxt.split(';')[0];
				else menutxt = "";
				menu1Span.appendChild(MakeOption(menutxt, -2, 'menu1link'+j), 0, 0);
			}
			select = document.createElement('a');
			select.innerHTML = 'Restore Defaults'; select.href = '#';
			select.setAttribute('class','tiny');
			select.addEventListener('click',function(event)
			{	event.stopPropagation(); event.preventDefault();
				if (confirm("Restore default menu options? (Just double-checking.)") == false) return;
				Defaults(1);
				for (var i=0; i<10; i++)
				{	var tag = document.getElementsByName('menu1link'+i+'tag')[0];
					var link = document.getElementsByName('menu1link'+i)[0];
					tag.value = GetPref('menu1link'+i).split(';')[0];
					if (tag.value == "undefined") tag.value = "";
					link.value = GetPref('menu1link'+i).split(';')[1];
					if (link.value == "undefined") link.value = "";
				} top.frames[0].location.reload();
			}, true);
			choice = document.createElement('input');
			choice.type = 'submit'; choice.setAttribute('class','button');
			choice.value = 'Apply'; choice.href = '#';
			choice.addEventListener('click',function(event)
			{	event.stopPropagation(); event.preventDefault();
				for (var i=0; i<10; i++)
				{	var tag = document.getElementsByName('menu1link'+i+'tag')[0].value;
					var link = document.getElementsByName('menu1link'+i)[0].value;
					if (tag != undefined && link != undefined && tag != "")
						SetPref('menu1link'+i,tag+';'+link);
					else SetPref('menu1link'+i,';');
				} top.frames[0].location.reload();
			}, true);
			menu1Span.appendChild(document.createElement('center'));
			menu1Span.lastChild.appendChild(select);
			menu1Span.lastChild.appendChild(document.createElement('br'));
			menu1Span.lastChild.appendChild(document.createElement('br'));
			menu1Span.lastChild.appendChild(choice);

			// Customized Links, Take 2
			for (var j=0; j<10; j++)
			{	var menutxt = GetPref('menu2link'+j);
				if (menutxt != undefined) menutxt = menutxt.split(';')[0];
				else menutxt = "";
				menu2Span.appendChild(MakeOption(menutxt, -2, 'menu2link'+j), 0, 0);
			}
			select = document.createElement('a');
			select.innerHTML = 'Restore Defaults'; select.href = '#';
			select.setAttribute('class','tiny');
			select.addEventListener('click',function(event)
			{	event.stopPropagation(); event.preventDefault();
				if (confirm("Restore default menu options? (Just double-checking.)") == false) return;
				Defaults(2);
				for (var i=0; i<10; i++)
				{	var tag = document.getElementsByName('menu2link'+i+'tag')[0];
					var link = document.getElementsByName('menu2link'+i)[0];
					tag.value = GetPref('menu2link'+i).split(';')[0];
					if (tag.value == "undefined") tag.value = "";
					link.value = GetPref('menu2link'+i).split(';')[1];
					if (link.value == "undefined") link.value = "";
				} top.frames[0].location.reload();
			}, true);
			choice = document.createElement('input');
			choice.type = 'submit'; choice.setAttribute('class','button');
			choice.value = 'Apply'; choice.href = '#';
			choice.addEventListener('click',function(event)
			{	for (var i=0; i<10; i++)
				{	var tag = document.getElementsByName('menu2link'+i+'tag')[0].value;
					var link = document.getElementsByName('menu2link'+i)[0].value;
					if (tag != undefined && link != undefined && tag != "")
						SetPref('menu2link'+i,tag+';'+link);
					else SetPref('menu2link'+i,';');
				} top.frames[0].location.reload(); event.stopPropagation(); event.preventDefault();
			}, true);
			menu2Span.appendChild(document.createElement('center'));
			menu2Span.lastChild.appendChild(select);
			menu2Span.lastChild.appendChild(document.createElement('br'));
			menu2Span.lastChild.appendChild(document.createElement('br'));
			menu2Span.lastChild.appendChild(choice);

			// Put it all together (-ish.)
			bigSpan.appendChild(menu1Span);
			bigSpan.appendChild(menu2Span);
			bigSpan.appendChild(document.createElement('hr'));

			var ul = document.createElement('a');
			var ulspan = document.createElement('div');
			ul.setAttribute('href','#');
			ul.innerHTML = "Check For Update";
			ul.addEventListener('click',function(event)
			{	GM_get("noblesse-oblige.org/hellion/scripts/MrScript.version.txt", function(txt)
				{	var uspan = document.getElementsByName('updatespan')[0];
					var txtsplit = txt.split(',');
					var versionNumber = txtsplit[0].replace('.','').replace('.','');
					if (parseInt(versionNumber,10) <= VERSION)
					{	uspan.innerHTML = "<br>No Update Available.";
						persist('MrScriptLastUpdate', parseInt(new Date().getTime()/3600000)); return;
					} else
					{	uspan.innerHTML = "<br>Version " + txtsplit[0] + " Available: <a target='_blank' href='" +
							txtsplit[1] + "'>Update</a>";
				}	}); event.stopPropagation(); event.preventDefault();
			}, true);
			var ul2 = document.createElement('a');
			ul2.setAttribute('href','javascript:void(0);');
			ul2.innerHTML = "Update Item DB";
			ul2.addEventListener('click',function(event)
			{	if (confirm("Are you sure? You should only perform this action if Mr. Script is not functioning properly."))
				{	UpdateItemDB(0); alert("Database will attempt to update. Please contact Hellion if the problem persists.");
			}	}, true);
//			var ul3 = document.createElement('a');
//			ul3.setAttribute('target', '_blank');
//			ul3.setAttribute('href','https://www.paypal.com/cgi-bin/webscr?'+
//'cmd=_donations&business=lukifer%40mail%2ecom&item_name=Mr%2e%20Script&page_style=PayPal&no_shipping=1&cn=Comments&tax=0&currency_code=USD&lc=US&bn=PP%2dDonationsBF&charset=UTF%2d8');
//			ul3.innerHTML = 'Say Thanks With Money!';
			var ul4 = document.createElement('a');
			ul4.setAttribute('href','javascript:void(0);');
			ul4.innerHTML = "Renew Password Hash";
			ul4.setAttribute('id','hashrenew');
			ul4.addEventListener('click',function(event)
			{	this.innerHTML = 'Working...';
				GM_get(server + '/store.php?whichstore=m', function(txt)
				{	var nupwd = txt.match(/phash\svalue\=\"([a-z0-9]+)\"/)[1];
					if(nupwd) { $("#hashrenew").html('Done'); SetPwd(nupwd); }
					else $("#hashrenew").html('Fail!');
			});	}, true);
			ulspan.setAttribute('class','tiny');
			ulspan.setAttribute('name','updatespan');
			var centre = document.createElement('center');
			centre.appendChild(ulspan);
			ulspan.appendChild(ul);
			ulspan.appendChild(document.createTextNode(' - '));
			ulspan.appendChild(ul2);
			ulspan.appendChild(document.createTextNode(' - '));
			ulspan.appendChild(ul4);
			ulspan.appendChild(document.createElement('br'));
//			ulspan.appendChild(document.createElement('br'));
//			ulspan.appendChild(document.createTextNode('Like Mr. Script? '));
//			ulspan.appendChild(ul3);
			bigSpan.appendChild(centre);

			var prefLink = document.createElement('a');
			prefLink.innerHTML = "Mr. Script's Choicetastic Optionarium";
			prefLink.setAttribute('href','javascript:toggle("scriptpref");');
			prefLink.setAttribute('onclick','if (document.getElementById("scriptpref").getAttribute("style").indexOf("none") != -1)' +
					' window.setTimeout("self.location.hash=\'opt\';",50)');
			var prefAnchor = document.createElement('a');
			prefAnchor.setAttribute('name','opt'); prefAnchor.innerHTML = " ";
			var pDiddy = document.createElement('p');
			pDiddy.appendChild(prefAnchor);
			pDiddy.appendChild(prefLink);
			pDiddy.appendChild(bigSpan);

			// Look at all these children. Tables get *around*, man.
			var addHere = tables[i].rows[1].firstChild.firstChild.firstChild.firstChild.firstChild.firstChild;
			addHere.appendChild(pDiddy); break;
}	}	}

// -----------------------------------------------------------
// HAGNK'S/MANAGESTORE/STASH: Support autoclear for added rows
// -----------------------------------------------------------
function managestore() {
  autoclear_added_rows();
}
function clan_stash() {
  autoclear_added_rows();
}
function storage() {
  autoclear_added_rows();
}
function sendmessage() {
  autoclear_added_rows();
}

function autoclear_added_rows()
{
	$('a[href^=javascript]').each(function()
	{
		var link = $(this);
		if (link.attr('href').indexOf('add') == -1) return;

		// A mouseout event is the easy way out, since I couldn't find a way
		// to trigger the event AFTER the extra row was added. Meh.
		link.mouseout(function()
		{	var autoclear = GetPref('autoclear');
			if (autoclear == 0) return;
			$('input[value=1][type=text]').each(function()
			{	if(this.getAttribute('onclick') == null)
					AddAutoClear(this, autoclear);
			});
		});
	});
}

// --------------------------------------
// MAINT: Refresh until rollover is over.
// --------------------------------------
function at_maint()
{	document.title="KoL Rollover";
	window.setTimeout('self.location = "http://www.kingdomofloathing.com";',30000);
}

//console.timeEnd("Mr. Script @ " + place);
