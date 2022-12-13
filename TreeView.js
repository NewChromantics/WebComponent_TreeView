export class TreeNodeElement extends HTMLElement 
{
	constructor()
	{
		super();
	}
	
	static ElementName()
	{
		return 'tree-node';
	}
	
}

//	todo; use a symbol that can't be a key character other wise ['x.x'].y isn't going to work
//		but still wants to be usable for users
const AddressDelin = '.';
const NodeClassName = 'Node';
const RootPartName = 'body'
const AddressPartDelin = '-';

function AsObjectSafe(Value,Default={})
{
	try
	{
		//	null attribute resolves to null, which is an object (so parses). Catch it
		if ( Value == null )
			return {};
		return JSON.parse(Value);
	}
	catch(e)
	{
		return {};
	}
}

function JsonToString(Value)
{
	//	todo: detect setting an object
	if ( typeof Value != typeof '' )
		Value = JSON.stringify(Value);
	return Value;
}

function SetAttributeTrueOrRemove(Element,Attribute,Boolean,Value)
{
	Value = (Value===undefined) ? Boolean : Value;
	 
	//	todo: minimise dom changes
	if ( Boolean )
	{
		Element.setAttribute(Attribute,Value);
	}
	else
	{
		Element.removeAttribute(Attribute);
	}
}

function IsTypedArray(obj)
{
	return !!obj && obj.byteLength !== undefined;
	//	gr: does this work outside of chromium? (jsc, chakra etc)
	const TypedArrayType = Object.getPrototypeOf(Uint8Array);
	return obj instanceof TypedArrayType;
}

//	should this value expand to another node in the tree?
function IsValueNodeChild(Value)
{
	//	null is an object, so check for it
	if ( !Value )
		return false; 
	
	//	not an object
	if ( typeof Value != typeof {} )
		return false;
	
	if ( Value.length && Value.length > 100 )
		return false;
	
	//	we allow arrays, maybe we should threshold a sensible array size?
	//	but we dont allow typed arrays
	if ( IsTypedArray(Value) )
		return false;
		
	return true;
}

function ValueAsText(Value)
{
	if ( IsTypedArray(Value) )
	{
		const TypeName = Value.constructor.name;
		const Size = Value.length;
		return `${TypeName} x${Size}`;
	}
	return `${Value}`;
}


function GetDefaultNodeMeta()
{
	const Meta = {};
	Meta.Collapsed = false;
	Meta.Visible = true;
	Meta.Draggable = false;
	Meta.Droppable = false;
	Meta.Selected = false;
	Meta.Writable = false;
	Meta.ElementType = 'div';
	Meta.Selectable = true;
	Meta.Deletable = false;
	return Meta;
}


function UseTextAreaForString(Value)
{
	return ( Value.includes('\t') ||
		Value.includes('\n') ||
		Value.length > 50 );
}		

function HandleTabKeyInTextArea(OnKeyDownEvent)
{
	const e = OnKeyDownEvent;
	//if ( e.which != 9 ) return;
	if ( e.key != 'Tab' )	return;

	const Start = this.selectionStart;
	const End = this.selectionEnd;
	this.value = this.value.substr( 0, Start ) + '\t' + this.value.substr( End );
	this.selectionStart = this.selectionEnd = Start + 1;
	e.preventDefault();
	return false;
}


function CreateWritableValueElement(Meta,InitialValue,OnChanged)
{
	const Value = InitialValue;
	//	does the meta have a specific component type?
	let ElementType = 'input';
	let InputType = Meta.type;
	let SetValue;
	let GetValue;

	if ( !InputType )
	{
		if ( typeof Value == typeof true )
			InputType = 'checkbox';
			
		if ( typeof Value == typeof 123 )
		{
			//	if the user has provided a min & max, default to a slider
			if ( Meta.hasOwnProperty('min') && Meta.hasOwnProperty('max') )
				InputType = 'range';
			else
				InputType = 'number';
		}

		if ( typeof Value == typeof '' )
		{
			//	use a textarea if the string is long/has line feeds
			if ( UseTextAreaForString(Value) )
			{
				ElementType = 'textarea';
				InputType = null;
				
				//	default textarea size
				Meta.rows = Meta.rows || 10;
				Meta.onkeydown = HandleTabKeyInTextArea;
			}
			else
				InputType = 'text';
		}
	}
		
	if ( !ElementType )
		return;

	let Element = document.createElement(ElementType);
	//	this will error accessing only a getter for textareas
	if ( InputType )
		Element.type = InputType;
	
	//	assign other meta, like min, max etc
	for ( let [AttributeKey,AttributeValue] of Object.entries(Meta) )
	{
		Element[AttributeKey] = AttributeValue;
	}

	const ValueKey = 'value';
	if ( Element.type == 'checkbox' )
	{
		SetValue = function(NewValue)
		{
			Element.checked = NewValue;
		}
		GetValue = function()
		{
			return Element.checked;
		}
		
		SetValue( Value );
		Element.onchange = () => OnChanged(Element);
	}
	else
	{
		SetValue = function(NewValue)
		{
			Element.value = NewValue;
		}
		GetValue = function()
		{
			if ( !isNaN(Element.valueAsNumber) )
				return Element.valueAsNumber;
			else
				return Element.value;
		}
		SetValue( Value );
		Element.oninput = () => OnChanged(Element,false);
		Element.onchange = () => OnChanged(Element);
	}
	
	//	should call SetValue() here, but don't want to invoke onchange for initialisation 
	Element.SetValue = SetValue;
	Element.GetValue = GetValue;
	
	return Element;
}








export default class TreeViewElement extends HTMLElement 
{
	constructor()
	{
		super();
		
		this.DomEvents = {};
	}
	
	static ElementName()
	{
		return 'tree-view';
	}
	ElementName()
	{
		return TreeViewElement.ElementName();
	}
	
	static get observedAttributes() 
	{
		return ['json','meta','css'];
	}
	
	//	get json attribute as object
	get json()		
	{
		//	we save json object as a cache, not really for performance, but because
		//	object with say, large typed arrays, turns into a huge huge string
		//	so keep it as an object as much as possible (warning: this means it's a reference that we can't safely modify!)
		if ( this.JsonCache )
			return this.JsonCache;
		return AsObjectSafe( this.getAttribute('json') );	
	}
	set json(Value)	
	{
		if ( typeof Value == typeof {} )
		{
			this.JsonCache = Value;
			//	note that we're not using the attribute, but also to trigger attribute change
			this.setAttribute('json','this.JsonCache');
			return;
		}
		this.setAttribute('json', JsonToString(Value) );	
	}
	
	//	if we're using jsoncache, we don't want to modify it directly
	//	this returns a deep copy (as much as possible) of the input json
	//	this will go wrong when it comes to typed members...
	//	can we detect this?
	get mutablejson()
	{
		//	json is just a string
		if ( !this.JsonCache )
			return this.json;
		
		//	need something better than this
		const Copy = JSON.parse( JSON.stringify(this.json) );
		return Copy;
	}

	get meta()		{	return AsObjectSafe( this.getAttribute('meta') );	}
	set meta(Value)	{	this.setAttribute('meta', JsonToString(Value) );	}
	
	get css()			{	return this.getAttribute('css');	}
	set css(Css)		{	Css ? this.setAttribute('css', Css) : this.removeAttribute('css');	}
	

	SetupDom(Parent)
	{
		this.RootElement = document.createElement('div');
		this.RootElement.className = this.ElementName();
		this.RootElement.part = RootPartName;
		//this.SetupNewTreeNodeElement( this.RootElement, [], undefined, this.GetNodeMeta(null), true );
		this.RootElement.Address = [];
		this.SetupDraggableTreeNodeElement( this.RootElement);
		
		
		this.Style = document.createElement('style');
		
		// attach the created elements to the shadow dom
		Parent.appendChild(this.Style);
		Parent.appendChild(this.RootElement);
		
		//	initialise if json attribute is set
		this.UpdateTreeElements();
	}
	
	attributeChangedCallback(name, oldValue, newValue) 
	{
		if ( name == 'json' )
			this.UpdateTreeElements();
		if ( name == 'meta' )
			this.UpdateTreeElements();
		
		if ( this.Style )
		{
			const Css = this.css; 
			this.Style.textContent = Css ? `@import "${Css}";` : '';
		}
	}
	
	connectedCallback()
	{
		//	Create a shadow root
		this.Shadow = this.attachShadow({mode: 'open'});
		this.SetupDom(this.Shadow);
		this.attributeChangedCallback();
	}
	
	SetNewJson(Json,Change)
	{
		this.json = Json;
		this.CallDomEvent('change',[Json,Change]);
	}
	
	//	todo: [re]create root element with _root meta
	get TreeContainer()	{	return this.RootElement;	}

	get TreeChildren()
	{
		let Children = Array.from( this.TreeContainer.children );
		Children = Children.filter( e => !(e instanceof HTMLStyleElement) );
		return Children;
	}
	
	//	fetch an element based on its json address, for some direct,
	//	non-stateful changes
	GetElement(AddressKey)
	{
		function RecursiveMatchChildren(Element)
		{
			if ( !Element )
				return null;

			const ElementAddressKey = this.GetAddressKey(Element.Address);
			if ( ElementAddressKey == AddressKey )
				return Element;
			
			//	search children
			const Children = Array.from( Element.children );
			for ( let Child of Children )
			{
				const Match = RecursiveMatchChildren.call( this, Child );
				if ( Match )
					return Match;
			}
			return null;
		}
		
		const RootElement = this.TreeContainer;
		const Match = RecursiveMatchChildren.call( this, RootElement );
		return Match;
	}
	
	MoveData(OldAddress,NewAddress,BeforeKey=null)
	{
		if ( OldAddress.every( (v,i) => NewAddress[i]==v ) )
			throw `Detected drop on self`;
			
		const Json = this.mutablejson;
		console.log(`Moving ${OldAddress} to ${NewAddress}`);

		//	find the old parent, and the key of the parent (and the data we're moving)
		let OldParent = Json;
		for ( let ok=0;	ok<OldAddress.length-1;	ok++ )
			OldParent = OldParent[OldAddress[ok]];
		const OldLastKey = OldAddress[OldAddress.length-1];
		let OldData = OldParent[OldLastKey];
		
		//	find the new parent (in a func, making NewParent const as we need to
		//	edit it in-place)
		function GetNewParent()
		{
			let NewParent = Json;
			for ( let nk=0;	nk<NewAddress.length;	nk++ )
				NewParent = NewParent[NewAddress[nk]];
			return NewParent;
		}
		const NewParent = NewAddress===false ? null : GetNewParent();
		
		//	detect if we're dropping onto the same depth as before
		//	where we don't want a new key, as it's a replacement
		//	todo: specific order
		const SameDepth = OldParent == NewParent;
		
		//	allow dropping onto something with the same key by adding a suffix to the key
		let NewKey = OldLastKey;
		if ( !SameDepth && NewParent )
		{
			while ( NewParent.hasOwnProperty(NewKey) )
			{
				NewKey += '+';
			}
			if ( NewParent.hasOwnProperty(NewKey) )
				throw `New parent already has a key ${NewKey}`;
		}

		//	in case we delete it, get the BeforeKey position now
		const BeforePosition = Object.entries( NewParent || {} ).findIndex( kv => kv[0] == BeforeKey );
		
		//	delete the old data from it's old parent
		delete OldParent[OldLastKey];

		if ( !NewParent )
		{
			//	data being deleted
		}
		//	put this key+data in a specific place
		else if ( BeforeKey )
		{
			let Entries = Object.entries( NewParent );
			let InsertPosition = BeforePosition + 0;	//	+1 for after
			const NewEntry = [NewKey,OldData];
			Entries.splice( InsertPosition, 0, NewEntry );
			
			//	need to edit NewParent in-place, so clear the old
			//	keys, then make a new object & assign
			//	gr: maybe could re-set keys in correct order?
			Object.keys( NewParent ).forEach( k => delete NewParent[k] );

			//	need to use a Map to keep order correct
			const NewParentObject = Object.fromEntries( new Map(Entries) );
			Object.assign( NewParent, NewParentObject );
		}
		else
		{
			//	put the new data, with the same old key, onto the new parent
			NewParent[NewKey] = OldData;
		}
			
		const Change = {};
		Change.Address = OldAddress;
		Change.MovedTo = NewAddress;
		this.SetNewJson(Json,Change);
	}
	
	ToggleSelected(ToggleElements,KeepExisting)
	{
		//	get a list of selected elements
		let WasSelectElements = [];
		function FindSelectedRecursive(Element)
		{
			let WasSelected = Element.hasAttribute('Selected');
			if ( WasSelected )
				WasSelectElements.push(Element);
			
			for ( let Child of Element.children )
				FindSelectedRecursive(Child);
		}
		const TreeChildren = this.TreeChildren;
		TreeChildren.forEach( FindSelectedRecursive );
		
		
		let UnselectElements = WasSelectElements;
		let SelectElements = ToggleElements;
		
		//	if the first element in the list is already selected, we dont re-select
		if ( ToggleElements.length )
		{
			const FirstElement = ToggleElements[0];
			if ( WasSelectElements.includes(FirstElement) )
			{
				if ( KeepExisting )
				{
					UnselectElements = ToggleElements;
					SelectElements = WasSelectElements;
					KeepExisting = false;
				}
				else
				{
					UnselectElements.push( ...ToggleElements );
					SelectElements = [];
				}
			}
		}
		
		//	unselect
		if ( !KeepExisting )
		{
			function Unselect(Element)
			{
				const Address = Element.Address;
				this.SetNodeMeta(Address,'Selected',false);
				Element.removeAttribute('Selected');
			}
			UnselectElements.forEach( Unselect.bind(this) );
		}
		
		//	select
		const SelectedAddresses = [];
		{
			function Select(Element)
			{
				const Address = Element.Address;
				this.SetNodeMeta(Address,'Selected',true);
				SelectedAddresses.push( Address );
				Element.setAttribute('Selected',true);
			}
			SelectElements.forEach( Select.bind(this) );
		}
		
		
		this.CallDomEvent('selectionchange',[SelectedAddresses]);
	}
	
	//	this function sets up events, even if dragging or dropping is disabled
	SetupDraggableTreeNodeElement(Element)
	{
		const Address = Element.Address;
			
		//	on ios its a css choice
		//	gr: not required https://stackoverflow.com/questions/6600950/native-html5-drag-and-drop-in-mobile-safari-ipad-ipod-iphone
		//Element.style.setProperty('webkitUserDrag','element');
		//Element.style.setProperty('webkitUserDrop','element');
		
		function GetDropTarget(Event)
		{
			if ( Element.droppable )
			{
				const Drop = {};
				Drop.Element = Element;
				return Drop;
			}
				
			//	if parent is droppable, use this element to
			//	determine an order
			if ( Element == this.RootElement )
				return null;

			const ParentElement = Element.parentNode;
			if ( !ParentElement.droppable )
				return null;
				
			const Drop = {};
			Drop.Element = ParentElement;
			//	todo: pick before or after depending on where the mouse is in the rect!
			Drop.BeforeElement = Element;
			return Drop;
		}
		
		function OnDragOver(Event)
		{
			const Target = GetDropTarget.call(this,Event);
			if ( !Target )
				return;
			
			//	continuously called
			//console.log(`OnDragOver ${Key}`);
			const HighlightElement = Target.BeforeElement||Target.Element;
			HighlightElement.setAttribute('DragOver',true);
			Event.stopPropagation();
			Event.preventDefault();	//	ios to accept drop
			
			//	seems to default to copy if you dont set this
			//	ios has no link icon, nothing has move icon
			//Event.dataTransfer.dropEffect = 'copy';
			//	copy then link here, drop will fail, but using link to get icon on desktop
			Event.dataTransfer.dropEffect = 'link';
			//Event.dataTransfer.dropEffect = 'move';
			//return true;
		}
		function OnDrop(Event)
		{
			const Key = Address[Address.length-1];
			console.log(`OnDrop ${Key}`,Element);
			
			const Target = GetDropTarget.call(this,Event);
			if ( !Target )
				return;

			const HighlightElement = Target.BeforeElement||Target.Element;
			HighlightElement.removeAttribute('DragOver');
			Event.preventDefault();
			Event.stopPropagation();	//	dont need to pass to parent
	
			//	move source object to dropped object
			const OldAddress = JSON.parse(Event.dataTransfer.getData('text/plain'));
			const NewAddress = Target.Element.Address;
			const BeforeKey = Target.BeforeElement ? Target.BeforeElement.Key : null;
			this.MoveData(OldAddress,NewAddress,BeforeKey);
		}
		
		function OnDragStart(Event)
		{
			if ( !Element.draggable )
				return;
			const Key = Address[Address.length-1];
			//console.log(`OnDragStart ${Key}`);
			//Event.dataTransfer.effectAllowed = 'all';
			Event.dataTransfer.dropEffect = 'link';	//	copy move link none
			Event.dataTransfer.setData('text/plain', JSON.stringify(Address) );
			
			Event.stopPropagation();	//	stops multiple objects being dragged
			//Event.preventDefault();	//	this stops drag entirely
			//return true;//	not required?
		}
		
		function OnDragLeave(Event)
		{
			const Key = Address[Address.length-1];
			//console.log(`OnDragLeave ${Key}`);
			Element.removeAttribute('DragOver');
		}
		
		function OnDragEnd(Event)
		{
			//console.log(`OnDragEnd ${Key}`);
			Element.removeAttribute('DragOver');			
			
			//	dont need to tell parent
			Event.stopPropagation();
		}
		
		function OnDrag(Event)
		{
			//	continuously called
			//console.log(`OnDrag`);
		}
		function OnDragEnter(Event)
		{
			let CanDrop = Element.droppable;
			if ( !CanDrop )
				return;
			//console.log(`OnDragEnter ${Key}`);
			//	this to allow this as a drop target
			Event.preventDefault();
			return true;
		}
		
		Element.addEventListener('dragstart',OnDragStart.bind(this));
		Element.addEventListener('dragenter',OnDragEnter.bind(this));
		Element.addEventListener('drag',OnDrag.bind(this));	//	would be good to allow temporary effects
		Element.addEventListener('dragend',OnDragEnd.bind(this));

		Element.addEventListener('drop',OnDrop.bind(this));
		Element.addEventListener('dragover',OnDragOver.bind(this));
		Element.addEventListener('dragleave',OnDragLeave.bind(this));
		
	}
	
	SetupNewTreeNodeElement(Element,Address,Value,Meta,ValueIsChild)
	{
		const IsRoot = Address.length == 0;
		const Key = Address[Address.length-1];
		const Indent = Address.length-1;

		//	custom meta
		Element.Address = Address;
		Element.AddressKey = this.GetAddressKey(Address);
		Element.Key = Key;

		//	assign other meta, like min, max etc
		//	this was for writable value element, but apply it here too
		//	gr: we may need to differentiate between the element & the value display...
		for ( let [AttributeKey,AttributeValue] of Object.entries(Meta) )
		{
			Element[AttributeKey] = AttributeValue;
		}
		Element.style.setProperty(`--Indent`,Indent);
		Element.style.setProperty(`--Key`,Key);
		Element.classList.add( NodeClassName );
		const AddressPartName = this.GetAddressPartName( Address );
		Element.part = `${NodeClassName} ${Key} ${AddressPartName}`;
		
		this.SetupDraggableTreeNodeElement( Element );

		//	currently intefering with inputs
		//	fix the event order/prevent default etc
		if ( !Meta.Writable )
		{
			if ( Meta.Selectable )
			{
				Element.onclick = function(Event)
				{
					const AppendSelect = Event.shiftKey;
					this.ToggleSelected( [Element], AppendSelect );

					Event.stopPropagation();
					Event.preventDefault();
				}.bind(this);
			}
		}
			
		if ( ValueIsChild && !IsRoot )
		{
			let Collapser = document.createElement('button');
			Collapser.className = 'Collapser';
			Collapser.value = 'Collapse';
			Element.appendChild(Collapser);	
			
			Collapser.onclick = function(Event)
			{
				let Collapsed = Element.getAttribute('Collapsed') == 'true';
				Collapsed = !Collapsed;
				Element.setAttribute('Collapsed',Collapsed);
				this.SetNodeMeta(Element.Address,'Collapsed',Collapsed);		
				Event.stopPropagation();
			}.bind(this);
		}
		
		if ( Meta.Deletable )
		{
			let Deleter = document.createElement('button');
			Deleter.className = 'Deleter';
			Deleter.value = 'Delete';
			Element.appendChild(Deleter);	
			
			Deleter.onclick = function(Event)
			{
				this.MoveData( Element.Address, false );
				Event.stopPropagation();
			}.bind(this);
		}
		
		
		let LabelElement = document.createElement('label');
		LabelElement.innerText = 'LABEL';
		Element.appendChild(LabelElement);	

		if ( !ValueIsChild )
		{
			function OnValueChanged(InputElement,IsFinalValue=true)
			{
				const Value = InputElement.GetValue();
				//console.log(`Value of ${Element.AddressKey} changed to ${Value}`,InputElement);
				const Json = this.mutablejson;
				let Node = Json;
				const Addresses = Element.Address.slice();
				const Leaf = Addresses.pop();
				for ( let a of Addresses )
					Node = Node[a];
				Node[Leaf] = Value;
				this.SetNewJson(Json);
			}
			let ValueElement = this.CreateValueElement( Meta, Value, OnValueChanged.bind(this) );
			Element.appendChild(ValueElement);	
			
			//	bit hacky, maybe should explicitly make a .LabelElement and .ValueElement
			Element.SetValue = ValueElement.SetValue;
			Element.GetValue = ValueElement.GetValue;
		}
	}

	CreateValueElement(Meta,Value,OnChanged)
	{
		if ( Meta.Writable )
		{
			const Element = CreateWritableValueElement( Meta, Value, OnChanged );
			if ( Element )
				return Element;
		}

		//	fallback if this type wasnt handled as well as for readonly
		{
			let Element = document.createElement('span');
			Element.SetValue = function(NewValue)	{	Element.innerText = ValueAsText(NewValue);	}
			Element.GetValue = function()			{	throw `GetValue() on a non writable value`;	}
			Element.SetValue(`VALUE`);
			return Element;
		}
	}

	
	SetupTreeNodeElement(Element,Address,Value,Meta,ValueIsChild)
	{
		//	we will have a collapsable children
		const ValueKeys = ValueIsChild ? Object.keys(Value) : [];
		const Key = Address[Address.length-1];
		
		//	for convinence, put all properties as attributes so we can easily style stuff in css
		if ( ValueIsChild )
		{
			for ( let [PropertyKey,PropertyValue] of Object.entries(Value) )
			{
				//	not all attributes names are allowed
				//	must start with a-zA-Z etc
				
				//	todo regex when this needs to get more complicated
				//	try and avoid throwing to help debugging
				if ( PropertyKey.length == 0 )
					continue;
				const KeyNumber = Number(PropertyKey[0]);
				const KeyStartsWithNumber = !isNaN(KeyNumber);
				if ( KeyStartsWithNumber )
					continue;
					
				try
				{
					Element.setAttribute(PropertyKey,PropertyValue);
				}
				catch{};
			}
		}
		
		//	Minimise changse
		if ( Element.ValueCache !== Value )
		{
			Element.ValueCache = Value;
			Element.style.setProperty(`--Value`,Value);
			
			//	gr: a root/object node doesnt ahve a value (so doesn't have set value)
			if ( Element.SetValue )
			{
				//	gr: should this set the cache too?
				Element.SetValue( Value );
			}
		}
		
		
		let Label = Key;
		if ( Meta.KeyAsLabel )
			Label = Value[Meta.KeyAsLabel];
		if ( Meta.ShowChildCount )
		{
			//	todo: change this to an attrib and display with css
			//	.keys() works on array or object
			const ChildCount = ValueKeys.length;
			Label += ` x${ChildCount}`;
		}
		let LabelElement = Array.from(Element.children).find( e => e.nodeName == 'LABEL' );
		if ( LabelElement )
		{
			if ( LabelElement.innerText != Label )
				LabelElement.innerText = Label;
		}
		
		//	.draggable is shorthand for the draggable attribute it seems, but
		//	default browser draggable is different for different elements (eg. img)
		Element.droppable = Meta.Droppable;
		Element.draggable = Meta.Draggable;
		
		SetAttributeTrueOrRemove( Element, 'Draggable', Meta.Draggable );
		SetAttributeTrueOrRemove( Element, 'Droppable', Meta.Droppable );
		SetAttributeTrueOrRemove( Element, 'Selected', Meta.Selected );
		//	attribute only exists on collapsable objects
		SetAttributeTrueOrRemove( Element, 'Collapsed', ValueIsChild, Meta.Collapsed );
		
		//console.log(`Element.draggable=${Element.draggable} .Draggable=${Element.Draggable} .droppable=${Element.droppable} .Droppable=${Element.Droppable}`);
	}
	
	GetAddressKey(Address)
	{
		if ( !Address )
			return null;
		const AddressKey = Address.join(AddressDelin);
		return AddressKey;
	}
	
	GetAddressPartName(Address)
	{
		if ( !Address )
			return null;
		const AddressKey = Address.join(AddressPartDelin);
		return AddressKey;
	}
	
	SetNodeMeta(Address,Property,Value)
	{
		const Meta = this.GetNodeMeta(Address);
		//	todo? reduce to non-default values only for legibility
		Meta[Property] = Value;
		const TreeMeta = this.meta;
		const AddressKey = this.GetAddressKey(Address);
		TreeMeta[AddressKey] = Meta;
		this.meta = TreeMeta;
	}
	
	GetNodeMeta(Address)
	{
		//	root address
		if ( Address === null )
			Address = ['_root'];
		
		
		const TreeMeta = this.meta;
		const Meta = GetDefaultNodeMeta();
		
		//	special case
		const AddressKey = this.GetAddressKey(Address);
		if ( TreeMeta.hasOwnProperty(AddressKey) )
		{
			const NodeMeta = TreeMeta[AddressKey];
			Object.assign( Meta, NodeMeta );
		}
		return Meta;
	}

	UpdateTreeElements()
	{
		//	no DOM yet
		if ( !this.TreeContainer )
			return;
			
		const Json = this.json;
		const TreeChildren = this.TreeChildren;
		
		//	should we put this logic in tree-node element type and recurse automatically?...
		//	may be harder to do edits
		let Parent = this.TreeContainer;

		//	update meta of root
		{
			const RootMeta = this.GetNodeMeta(['_root']);
			this.SetupTreeNodeElement( Parent, '_root', {}, RootMeta, true );
		}

		
		function RecursivelyUpdateObject(NodeObject,ParentNode,ParentElement,Address)
		{
			//	catch any out of order elements
			let ElementsInOrder = true;
			
			const ChildNodes = Object.entries(NodeObject);
			
			function GetChildElements()
			{
				let Elements = Array.from(ParentElement.children);
				//	filter out collapsable buttons, labels etc
				Elements = Elements.filter( e => e.hasOwnProperty('AddressKey') );
				return Elements;
			}
			
			
			//	remove children no longer present
			{
				const ChildKeys = Object.keys(NodeObject);
				const ChildElements = GetChildElements();
				function ElementHasNode(Element)
				{
					return ChildKeys.includes(Element.Key);
				}
				const Missing = ChildElements.filter( e => !ElementHasNode(e) );
				if ( Missing.length )
					Missing.forEach( e => ParentElement.removeChild(e) );
			}
			
			let ChildWithNoElementCount = 0;
			for ( let ChildIndex in ChildNodes )
			{
				ChildIndex = Number(ChildIndex);
				const [Key,Value] = ChildNodes[ChildIndex];
				const ChildAddress = [...Address,Key];
				const ChildAddressKey = this.GetAddressKey(ChildAddress);
				const ChildMeta = this.GetNodeMeta( ChildAddress );
				let ParentChildElements = GetChildElements();
				let ChildElementIndex = ParentChildElements.findIndex( e => e.AddressKey == ChildAddressKey );
				let ChildElement = ParentChildElements[ChildElementIndex];
	
				//	skip element (and remove if neccessary)
				if ( !ChildMeta.Visible )
				{
					if ( ChildElement )
						ParentElement.removeChild(ChildElement);
					ChildWithNoElementCount++;
					continue;
				}

				const ChildValueIsObject = IsValueNodeChild(Value);

				if ( !ChildElement )
				{
					try
					{
						ChildElement = document.createElement(ChildMeta.ElementType);
					}
					catch(e)
					{
						console.warn(e);
						const DefaultElementType = GetDefaultNodeMeta().ElementType;
						ChildElement = document.createElement(DefaultElementType);
					}
					ParentElement.appendChild(ChildElement);
					this.SetupNewTreeNodeElement( ChildElement, ChildAddress, Value, ChildMeta, ChildValueIsObject );
				}

				this.SetupTreeNodeElement( ChildElement, ChildAddress, Value, ChildMeta, ChildValueIsObject );
	
				//	do order check late so new elements dont need re-sorting below
				{
					ParentChildElements = GetChildElements();
					ChildElementIndex = ParentChildElements.findIndex( e => e.AddressKey == ChildAddressKey );
					if ( ChildElementIndex+ChildWithNoElementCount != ChildIndex )
						ElementsInOrder = false;
				}

				if ( ChildValueIsObject )
				{
					RecursivelyUpdateObject.call( this, Value, NodeObject, ChildElement, ChildAddress );
				}
			}
			
			
			//	elements are out of order
			if ( !ElementsInOrder )
			{
				//console.log(`re-ordering dom`);
				//	re-append child elements from 0 to N
				for ( let ChildIndex in ChildNodes )
				{
					const [Key,Value] = ChildNodes[ChildIndex];
					const ChildAddress = [...Address,Key];
					const ChildAddressKey = this.GetAddressKey(ChildAddress);
					const ChildElements = GetChildElements();
					let ChildElement = ChildElements.find( e => e.AddressKey == ChildAddressKey );
					if ( ChildElement )
						ParentElement.appendChild( ChildElement );
					else
					{
						//	gr: this is okay if it's a non-visible element
						//console.warn(`Element gone missing`);
					}
				}
			}
		}
		RecursivelyUpdateObject.call( this, Json, {}, this.TreeContainer, [] );
	}
	
	CallDomEvent(DomEventName,Arguments)
	{
		//	cache ondataevent attribute into a functor
		if ( !this.DomEvents[DomEventName] && this.hasAttribute(`on${DomEventName}`) )
		{
			const EventFunctionString = this.getAttribute(`on${DomEventName}`);
			this.DomEvents[DomEventName] = window.Function(EventFunctionString);
		}

		//if ( !this.DomEvents[DomEventName] && this.hasOwnProperty(`on${DomEventName}`) )
		if ( !this.DomEvents[DomEventName] && this[`on${DomEventName}`] )
		{
			this.DomEvents[DomEventName] = this[`on${DomEventName}`];
		}

		//	todo: dispatch event for addListener support
		//this.dispatchEvent( new CustomEvent(DomEventName) )

		const Event = this.DomEvents[DomEventName];
		if ( Event )
		{
			try
			{
				Event(...Arguments);
			}
			catch(e)
			{
				console.error(`on${DomEventName} exception; ${e}`);
			}
		}
	}
}

//	name requires dash!
window.customElements.define( TreeViewElement.ElementName(), TreeViewElement );

