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
		const IsObject = ( typeof Value == typeof {} );
		
		//	set css variable
		Element.style.setProperty(`--Indent`,Indent);
		Element.style.setProperty(`--Key`,Key);
		Element.style.setProperty(`--Value`,Value);
		
		//	toggle collapsable
		//	attribute only exists on collapsable objects
		if ( IsObject )
		{
			Element.setAttribute('Collapsed',false);
			
			Element.onclick = function(Event)
			{
				let Collapsed = Element.getAttribute('Collapsed') == 'true';
				Collapsed = !Collapsed;
				Element.setAttribute('Collapsed',Collapsed);
				Event.stopPropagation();
			}
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
