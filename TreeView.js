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
	
	get TreeContainer()	{	return this.RootElement;	}

	get TreeChildren()
	{
		let Children = Array.from( this.TreeContainer.children );
		Children = Children.filter( e => e instanceof TreeNodeElement );
		return Children;
	}
	
	SetupTreeNodeElement(Element,Indent,Key,Value)
	{
		const IsObject = typeof Value == typeof {};
		
		//	set css variable
		Element.Key = Key;
		Element.Value = Value;
		Element.style.setProperty(`--Indent`,Indent);
		Element.style.setProperty(`--Key`,Key);
		Element.style.setProperty(`--Value`,Value);
		
		
		Element.setAttribute('draggable',true);
		//	on ios its a css choice
		//	gr: not required https://stackoverflow.com/questions/6600950/native-html5-drag-and-drop-in-mobile-safari-ipad-ipod-iphone
		Element.style.setProperty('webkitUserDrag','element');
		Element.style.setProperty('webkitUserDrop','element');
		
		
		function OnDragOver(Event)
		{
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
			console.log(`OnDrop ${Key}`);
			Element.removeAttribute('DragOver');
			Event.preventDefault();
			Event.stopPropagation();	//	dont need to pass to parent
		}
		
		function OnDragStart(Event)
		{
			//console.log(`OnDragStart ${Key}`);
			//Event.dataTransfer.effectAllowed = 'all';
			Event.dataTransfer.dropEffect = 'link';	//	copy move link none
			Event.dataTransfer.setData('text/plain', 'hello');
			
			Event.stopPropagation();	//	stops multiple objects being dragged
			//Event.preventDefault();	//	this stops drag entirely
			//return true;//	not required?
		}
		
		function OnDragEnd(Event)
		{
			console.log(`OnDragEnd ${Key}`);
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
			console.log(`OnDragEnter ${Key}`);
			//	this to allow this as a drop target
			Event.preventDefault();
			return true;
		}
		
		Element.addEventListener('dragstart',OnDragStart);
		Element.addEventListener('dragenter',OnDragEnter);
		Element.addEventListener('drag',OnDrag);	//	would be good to allow temporary effects
		Element.addEventListener('dragend',OnDragEnd);

		Element.addEventListener('drop',OnDrop);
		Element.addEventListener('dragover',OnDragOver);
		Element.addEventListener('dragleave',OnDragLeave);
		
		
		
		//	toggle collapsable
		//	attribute only exists on collapsable objects
		if ( IsObject )
		{
			Element.setAttribute('Collapsed',false);
			/*
			Element.onclick = function(Event)
			{
				let Collapsed = Element.getAttribute('Collapsed') == 'true';
				Collapsed = !Collapsed;
				Element.setAttribute('Collapsed',Collapsed);
				Event.stopPropagation();
			}
			*/
		}
		
		
		if ( IsObject )
			Element.innerHTML = ` ${Key}`;
		else
			Element.innerHTML = `${Key}: ${Value}`;

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
		
		function RecursivelyAddObject(NodeObject,Parent,Indent=0)
		{
			for ( let [Key,Value] of Object.entries(NodeObject) )
			{
				let Child = document.createElement(TreeNodeElementType);
				Parent.appendChild(Child);
				SetupTreeNodeElement( Child, Indent, Key, Value );
				
				if ( typeof Value == typeof {} )
				{
					RecursivelyAddObject( Value, Child, Indent+1 );
				}
			}
		}
		RecursivelyAddObject( Json, this.TreeContainer );
	}
}

//	name requires dash!
window.customElements.define( TreeViewElement.ElementName(), TreeViewElement );

