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


export default class TreeViewElement extends HTMLElement 
{
	constructor()
	{
		super();
		
		this.onchange = function(NewJson,Change)
		{
			console.log(`TreeViewElement change; ${JSON.stringify(Change,null,'\t')}`);
		};
		this.onselectionchange = function(NewSelections)
		{
			console.log(`TreeViewElement now selected; ${NewSelections}`);
		}
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
	get json()		{	return AsObjectSafe( this.getAttribute('json') );	}
	set json(Value)	{	this.setAttribute('json', JsonToString(Value) );	}
	get meta()		{	return AsObjectSafe( this.getAttribute('meta') );	}
	set meta(Value)	{	this.setAttribute('meta', JsonToString(Value) );	}
	
	get css()			{	return this.getAttribute('css');	}
	set css(Css)		{	Css ? this.setAttribute('css', Css) : this.removeAttribute('css');	}
	

	SetupDom(Parent)
	{
		this.RootElement = document.createElement('div');
		this.RootElement.className = this.ElementName();
		
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
		this.onchange(Json,Change);
	}
	
	get TreeContainer()	{	return this.RootElement;	}

	get TreeChildren()
	{
		let Children = Array.from( this.TreeContainer.children );
		Children = Children.filter( e => e instanceof TreeNodeElement || e instanceof HTMLDivElement );
		return Children;
	}
	
	MoveData(OldAddress,NewAddress)
	{
		if ( OldAddress.every( (v,i) => NewAddress[i]==v ) )
			throw `Detected drop on self`;
			
		const Json = this.json;
		console.log(`Moving ${OldAddress} to ${NewAddress}`);

		//	find the old parent, and the key of the parent (and the data we're moving)
		let OldParent = Json;
		for ( let ok=0;	ok<OldAddress.length-1;	ok++ )
			OldParent = OldParent[OldAddress[ok]];
		const OldLastKey = OldAddress[OldAddress.length-1];
		let OldData = OldParent[OldLastKey];
		
		//	find the new parent
		let NewParent = Json;
		for ( let nk=0;	nk<NewAddress.length;	nk++ )
			NewParent = NewParent[NewAddress[nk]];
		//OldAddress.reduce( (Key,Obj) => Obj[Key], Json );

		//	allow dropping onto something with the same key by adding a suffix to the key
		let NewKey = OldLastKey;
		while ( NewParent.hasOwnProperty(NewKey) )
		{
			NewKey += '+';
		}
		if ( NewParent.hasOwnProperty(NewKey) )
			throw `New parent already has a key ${NewKey}`;
		//	put the new data, with the same old key, onto the new parent
		NewParent[NewKey] = OldData;
		//	delete the old data from it's old parent
		delete OldParent[OldLastKey];
			
		const Change = {};
		Change.Address = OldAddress;
		Change.MovedTo = NewAddress;
		this.SetNewJson(Json,Change);
	}
	
	ToggleSelected(Elements,KeepExisting)
	{
		let SelectedElements = [];
		function Traverse(Element)
		{
			const ToggleThis = Elements.includes(Element);
			let WasSelected = Element.hasAttribute('Selected');
			if ( ToggleThis )
			{
				if ( !WasSelected )
				{
					Element.setAttribute('Selected',true);
					SelectedElements.push(Element);
				}
				else
				{
					Element.removeAttribute('Selected');
				}
			}
			else if ( !KeepExisting )
			{
				Element.removeAttribute('Selected');
			}
			else if ( WasSelected )
			{
				SelectedElements.push(Element);
			}
			
			for ( let Child of Element.children )
			{
				Traverse(Child);
			}
		}

		const TreeChildren = this.TreeChildren;
		TreeChildren.forEach( Traverse );
		
		let SelectedAddresses = SelectedElements.map( e => e.Address );
		SelectedAddresses = SelectedAddresses.filter( a => a!=null );
		SelectedAddresses.forEach( a => this.SetNodeMeta(a,'Selected',true) );
		
		this.onselectionchange(SelectedAddresses);
	}
	
	SetupNewTreeNodeElement(Element,Address,Value,Meta,ValueIsChild)
	{
		const Key = Address[Address.length-1];
		Element.Address = Address;
		Element.AddressKey = this.GetAddressKey(Address);
		Element.Key = Key;

		//	on ios its a css choice
		//	gr: not required https://stackoverflow.com/questions/6600950/native-html5-drag-and-drop-in-mobile-safari-ipad-ipod-iphone
		Element.style.setProperty('webkitUserDrag','element');
		Element.style.setProperty('webkitUserDrop','element');
		
		
		function OnDragOver(Event)
		{
			let CanDrop = Element.Droppable;
/*	dont have this data here!
			//	dont allow drop on self
			let OldAddress = Event.dataTransfer.getData('text/plain');
			OldAddress = JSON.parse(OldAddress);
			const NewAddress = Element.Address;
			if ( OldAddress.all( (v,i) => NewAddress[i]==v ) )
				CanDrop = false;
			*/
			//	let dragover propogate
			if ( !CanDrop )
				return;
			
			//	continuously called
			//console.log(`OnDragOver ${Key}`);
			Element.setAttribute('DragOver',true);
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
		function OnDragLeave(Event)
		{
			//console.log(`OnDragLeave ${Key}`);
			Element.removeAttribute('DragOver');
		}
		function OnDrop(Event)
		{
			console.log(`OnDrop ${Key}`,Element);
			let CanDrop = Element.Droppable;
			//	let dragover propogate
			if ( !CanDrop )
				return;
				
			Element.removeAttribute('DragOver');
			Event.preventDefault();
			Event.stopPropagation();	//	dont need to pass to parent
			
			//	move source object to dropped object
			const OldAddress = JSON.parse(Event.dataTransfer.getData('text/plain'));
			const NewAddress = Element.Address;
			this.MoveData(OldAddress,NewAddress);
		}
		
		function OnDragStart(Event)
		{
			//console.log(`OnDragStart ${Key}`);
			//Event.dataTransfer.effectAllowed = 'all';
			Event.dataTransfer.dropEffect = 'link';	//	copy move link none
			Event.dataTransfer.setData('text/plain', JSON.stringify(Address) );
			
			Event.stopPropagation();	//	stops multiple objects being dragged
			//Event.preventDefault();	//	this stops drag entirely
			//return true;//	not required?
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
			let CanDrop = Element.Droppable;
			if ( !CanDrop )
				return;
			//console.log(`OnDragEnter ${Key}`);
			//	this to allow this as a drop target
			Event.preventDefault();
			return true;
		}
		
		Element.addEventListener('dragstart',OnDragStart);
		Element.addEventListener('dragenter',OnDragEnter);
		Element.addEventListener('drag',OnDrag);	//	would be good to allow temporary effects
		Element.addEventListener('dragend',OnDragEnd);

		Element.addEventListener('drop',OnDrop.bind(this));
		Element.addEventListener('dragover',OnDragOver);
		Element.addEventListener('dragleave',OnDragLeave);
		
		Element.onclick = function(Event)
		{
			const AppendSelect = Event.shiftKey;
			this.ToggleSelected( [Element],AppendSelect);

			Event.stopPropagation();
			Event.preventDefault();
		}.bind(this);
		
		if ( ValueIsChild )
		{
			let Collapser = document.createElement('button');
			Collapser.className = 'Collapser';
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
		
		
		let LabelElement = document.createElement('label');
		LabelElement.innerText = 'LABEL';
		Element.appendChild(LabelElement);	

		if ( !ValueIsChild )
		{
			let ValueElement = document.createElement('span');
			ValueElement.innerText = 'VALUE';
			Element.appendChild(ValueElement);	
		}
	}
	
	SetupTreeNodeElement(Element,Address,Value,Meta,ValueIsChild)
	{
		//	we will have a collapsable children
		const ValueKeys = ValueIsChild ? Object.keys(Value) : [];
		const Key = Address[Address.length-1];
		const Indent = Address.length-1;
		
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
		
		//	set css variable
		Element.Value = Value;
		Element.style.setProperty(`--Indent`,Indent);
		Element.style.setProperty(`--Key`,Key);
		Element.style.setProperty(`--Value`,Value);
		Element.Droppable = Meta.Droppable;
		
		if ( Meta.Draggable )
			Element.setAttribute('Draggable',true);
		if ( Meta.Droppable )
			Element.setAttribute('Droppable',true);
		if ( Meta.Selected )
			Element.setAttribute('Selected',true);
		else
			Element.removeAttribute('Selected');
			
		
		//	toggle collapsable
		//	attribute only exists on collapsable objects
		if ( ValueIsChild )
		{
			Element.setAttribute('Collapsed',Meta.Collapsed==true);
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
			LabelElement.innerText = Label;

		let ValueElement = Array.from(Element.children).find( e => e.nodeName == 'SPAN' );
		if ( ValueElement )
			ValueElement.innerText = Value;
		
	}
	
	GetAddressKey(Address)
	{
		const AddressKey = Address.join(AddressDelin);
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
		function GetDefaultNodeMeta()
		{
			const Meta = {};
			Meta.Collapsed = false;
			Meta.Visible = true;
			Meta.Draggable = false;
			Meta.Droppable = false;
			Meta.Selected = false;
			return Meta;
		}
		
		const TreeMeta = this.meta;
		const Meta = GetDefaultNodeMeta();
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
		//const TreeNodeElementType = TreeNodeElement.ElementName();
		const TreeNodeElementType = 'div';
		
		/*
		//	todo: give every item an address;
		//	[key,key,key,key] so we can identify nodes & elements
		//	all elements for now
		while ( this.TreeChildren.length > 0 )
		{
			const LastIndex = this.TreeChildren.length-1;
			this.TreeContainer.removeChild( this.TreeChildren[LastIndex] );
		}
		*/
		
		//	should we put this logic in tree-node and recurse automatically?...
		//	may be harder to do edits
		let Parent = this.TreeContainer;
		
		let SetupTreeNodeElement = this.SetupTreeNodeElement.bind(this);
		
		
		function RecursivelyUpdateObject(NodeObject,ParentNode,ParentElement,Address)
		{
			//let NodeMeta = this.GetNodeMeta(Address);
				
			for ( let [Key,Value] of Object.entries(NodeObject) )
			{
				const ChildAddress = [...Address,Key];
				const ChildAddressKey = this.GetAddressKey(ChildAddress);
				const ChildMeta = this.GetNodeMeta( ChildAddress );
				let ChildElement = Array.from(ParentElement.children).find( e => e.AddressKey == ChildAddressKey );

				if ( !ChildMeta.Visible )
				{
					if ( ChildElement )
						ParentElement.removeChild(ChildElement);
					continue;
				}
				
				const ChildValueIsObject = Value!==null && ( typeof Value == typeof {} );

				if ( !ChildElement )
				{
					ChildElement = document.createElement(TreeNodeElementType);
					ParentElement.appendChild(ChildElement);
					this.SetupNewTreeNodeElement( ChildElement, ChildAddress, Value, ChildMeta, ChildValueIsObject );
				}

				this.SetupTreeNodeElement( ChildElement, ChildAddress, Value, ChildMeta, ChildValueIsObject );
				
				if ( ChildValueIsObject )
				{
					RecursivelyUpdateObject.call( this, Value, NodeObject, ChildElement, ChildAddress );
				}
			}
		}
		RecursivelyUpdateObject.call( this, Json, {}, this.TreeContainer, [] );
	}
}

//	name requires dash!
window.customElements.define( TreeViewElement.ElementName(), TreeViewElement );

