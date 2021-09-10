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

export default class TreeViewElement extends HTMLElement 
{
	constructor()
	{
		super();
		
		this.onchange = function(){};
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
		return ['json','css'];
	}
	
	//	get json attribute as object
	get json()			
	{
		try
		{
			let Value = this.getAttribute('json');
			return JSON.parse(Value);
		}
		catch(e)
		{
			return {};
		}
	}
	//	todo: detect setting an object
	set json(Value)	
	{
		if ( typeof Value != typeof '' )
			Value = JSON.stringify(Value);
		this.setAttribute('json', Value);	
	}
	
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
	}
	
	attributeChangedCallback(name, oldValue, newValue) 
	{
		if ( name == 'json' )
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
	
	SetNewJson(Json)
	{
		this.json = Json;
		this.onchange(Json);
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
			
		this.SetNewJson(Json);
	}
	
	SetupTreeNodeElement(Element,Address,Value,Meta)
	{
		//	we will have a collapsable children
		const ValueIsChild = Meta.ValueIsChild;
		const Key = Address[Address.length-1];
		const Indent = Address.length-1;
		
		//	for convinence, put all properties as attributes so we can easily style stuff in css
		if ( typeof Value == typeof {} )
		{
			for ( let [PropertyKey,PropertyValue] of Object.entries(Value) )
			{
				//	not all attributes names are allowed
				//	must start with a-zA-Z etc
				try
				{
					Element.setAttribute(PropertyKey,PropertyValue);
				}
				catch{};
			}
		}
		
		//	set css variable
		Element.Address = Address;
		Element.Key = Key;
		Element.Value = Value;
		Element.style.setProperty(`--Indent`,Indent);
		Element.style.setProperty(`--Key`,Key);
		Element.style.setProperty(`--Value`,Value);
		Element.Droppable = Meta.Droppable;
		
		if ( Meta.Draggable )
			Element.setAttribute('draggable',true);
		if ( Meta.Droppable )
			Element.setAttribute('droppable',true);
			
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
		
		
		
		//	toggle collapsable
		//	attribute only exists on collapsable objects
		if ( ValueIsChild )
		{
			Element.setAttribute('Collapsed',Meta.Collapsed==true);
			
			Element.onclick = function(Event)
			{
				let Collapsed = Element.getAttribute('Collapsed') == 'true';
				Collapsed = !Collapsed;
				Element.setAttribute('Collapsed',Collapsed);
				Event.stopPropagation();
			}
			
		}
		
		let Label = Key;
		if ( Meta.KeyAsLabel )
			Label = Value[Meta.KeyAsLabel];
		
		if ( ValueIsChild )
			Element.innerHTML = `<label>${Label}</label>`;
		else
			Element.innerHTML = `<label>${Label}</label><span>${Value}</span>`;

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
		
		//	todo: give every item an address;
		//	[key,key,key,key] so we can identify nodes & elements
		//	all elements for now
		while ( this.TreeChildren.length > 0 )
		{
			const LastIndex = this.TreeChildren.length-1;
			this.TreeContainer.removeChild( this.TreeChildren[LastIndex] );
		}
		
		//	should we put this logic in tree-node and recurse automatically?...
		//	may be harder to do edits
		let Parent = this.TreeContainer;
		
		let SetupTreeNodeElement = this.SetupTreeNodeElement.bind(this);
		
		function RecursivelyAddObject(NodeObject,ParentNode,ParentElement,Address)
		{
			let NodeMeta = {};
			NodeMeta.Ignore = [];
			Object.assign( NodeMeta, NodeObject._TreeMeta );
			NodeMeta.Ignore.push('_TreeMeta');
				
			for ( let [Key,Value] of Object.entries(NodeObject) )
			{
				//	ignore keys
				if ( NodeMeta.Ignore.includes(Key) )
					continue;
				
				const ChildAddress = [...Address,Key];
				const ChildElement = document.createElement(TreeNodeElementType);
				ParentElement.appendChild(ChildElement);

				const ChildIsObject = ( typeof Value == typeof {} );
				
				const ChildNodeMeta = Object.assign( {}, Value._TreeMeta );
				ChildNodeMeta.ValueIsChild = ChildIsObject;
				SetupTreeNodeElement( ChildElement, ChildAddress, Value, ChildNodeMeta );
				
				if ( ChildNodeMeta.ValueIsChild )
				{
					RecursivelyAddObject( Value, NodeObject, ChildElement, ChildAddress );
				}
			}
		}
		RecursivelyAddObject( Json, {}, this.TreeContainer, [] );
	}
}

//	name requires dash!
window.customElements.define( TreeViewElement.ElementName(), TreeViewElement );

