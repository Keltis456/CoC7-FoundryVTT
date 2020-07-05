import { COC7 } from '../config.js'

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class CoC7Item extends Item {


	/**
	 * Augment the basic Item data model with additional dynamic data.
	*/
	prepareData() {
		super.prepareData();
	}

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
	async roll({configureDialog=true}={}) {
		const token = this.actor.token;
		const templateData = {
			actor: this.actor,
			tokenId: token ? `${token.scene._id}.${token.id}` : null,
			item: this.data
		}

		const template = `systems/CoC7/templates/chat/skill-card.html`;
		const html = await renderTemplate(template, templateData);
				
		// TODO change the speaker for the token name not actor name
		const speaker = ChatMessage.getSpeaker({actor: this.actor});
		if( token) speaker.alias = token.name;

		const test = await ChatMessage.create({
			user: game.user._id,
			speaker,
			content: html
		});
	}

	/**
	 * Toggle on of the item property in data.data.properties
	 * @param {String} propertyId : name for the property to toggle
	 */	
	async toggleProperty( propertyId){
		let checkedProps = {};
		let fighting;
		let firearms;
		if( "skill" == this.type){
			let modif = false;
			if( "combat" ==  propertyId) {
				if( !this.data.data.properties.combat){
					//Close combat by default
					if( !this.data.data.properties.firearm){
						fighting = true;
					} else firearms = true;

				}else{
					checkedProps = {
						"data.properties.combat": false,
						"data.properties.special": false,
						"data.properties.fighting": false,
						"data.properties.firearm": false,
						"data.specialization": null
					}
				}
				modif = true;
			}

			if( "fighting" == propertyId){
				if( !this.data.data.properties.fighting){
					firearms = false;
					fighting = true;
				}else{
					firearms = true;
					fighting = false;
				}
				modif = true;
			}

			if( "firearm" == propertyId){
				if( !this.data.data.properties.firearm){
					firearms = true;
					fighting = false;
				}else{
					firearms = false;
					fighting = true;
				}
				modif = true;
			}

			if( modif){
				//set specialisation if fighting or firearm
				if(fighting){
					checkedProps = {
						"data.properties.fighting": true,
						"data.properties.firearm": false,
						"data.properties.combat": true,
						"data.properties.special": true,
						"data.specialization": COC7.fightingSpecializationName
					}
				}
				
				if(firearms){
					checkedProps = {
						"data.properties.fighting": false,
						"data.properties.firearm": true,
						"data.properties.combat": true,
						"data.properties.special": true,
						"data.specialization": COC7.firearmSpecializationName
					}
				}
			}
		}

		if(Object.keys(checkedProps).length > 0){
			const item = await this.update( checkedProps);
			return item;
		} 
		else {
			const propName = `data.properties.${propertyId}`;
			const propValue = !this.data.data.properties[propertyId];
			this.update( {[propName]: propValue}).then( item => { return item;});
		}
	}

	hasProperty( propertyId){
		return this.isIncludedInSet( "properties", propertyId);
	}


	async checkWeaponProperties(){
		if( this.type != "weapon") return;
		for (const property in this.data.data.properties) {
			
		}
	}

	async checkSkillProperties(){
		if( this.type != "skill") return;
		const checkedProps = {};
		if( this.data.data.properties.combat) {

			//if skill is not a specialisation make it a specialisation
			if(!this.data.data.properties.special){
				this.data.data.properties.special = true;
				checkedProps["data.properties.special"] = true;
			}

			//If skill is combat skill and no specialisation set then make it a fighting( closecombat) skill
			if( !this.data.data.properties.fighting && !this.data.data.properties.firearm){
				this.data.data.properties.fighting = true;
				checkedProps["data.properties.fighting"] = true;
			}


			//if skill is close combat without specialisation name make set it according to the fightingSpecializationName
			if(this.data.data.properties.fighting && (!this.data.data.specialization || this.data.data.specialization == "")){
				this.data.data.specialization = COC7.fightingSpecializationName;
				checkedProps["data.specialization"] = COC7.fightingSpecializationName;
			}

			//if skill is range combat without a specialisation name make set it according to the firearmSpecializationName
			if(this.data.data.properties.firearm && (!this.data.data.specialization || this.data.data.specialization == "")){
				this.data.data.specialization = COC7.firearmSpecializationName;
				checkedProps["data.specialization"] = COC7.firearmSpecializationName;
			}
		}else{
			if( this.data.data.properties.fighting){
				this.data.data.properties.fighting = false;
				checkedProps["data.properties.fighting"] = false;
			}
			if( this.data.data.properties.firearm){
				this.data.data.properties.firearm = false;
				checkedProps["data.properties.firearm"] = false;
			}
		}

		if(Object.keys(checkedProps).length > 0){
			await this.update( checkedProps);
		}

		return checkedProps;

			
		// for (const property in this.data.data.properties) {
		// 	checkedProps[`data.data.properties${property}`] = true;
		// }
	}

	// async toggleInSet( set, propertyId){
	// 	if( this.data.data[set][propertyId] == "false") this.data.data[set][propertyId] = "true"; else this.data.data[set][propertyId] = "false";
	// }

	isIncludedInSet( set, propertyId){
		if(!this.data.data[set]) this.data.data[set] = [];
		const propertyIndex = this.data.data[set].indexOf( propertyId);
		if( propertyIndex > -1) return true;
		return false;
	}

	/**
	 * Get the Actor which is the author of a chat card
	 * @param {HTMLElement} card    The chat card being used
	 * @return {Actor|null}         The Actor entity or null
	 * @private
	 */
	static _getChatCardActor(card) {

		// Case 1 - a synthetic actor from a Token
		const tokenKey = card.dataset.tokenId;
		if (tokenKey) {
			const [sceneId, tokenId] = tokenKey.split(".");
			const scene = game.scenes.get(sceneId);
			if (!scene) return null;
			const tokenData = scene.getEmbeddedEntity("Token", tokenId);
			if (!tokenData) return null;
			const token = new Token(tokenData);
			return token.actor;
		}

		// Case 2 - use Actor ID directory
		const actorId = card.dataset.actorId;
		return game.actors.get(actorId) || null;
	}
	

	/* -------------------------------------------- */
	/*  Chat Message Helpers                        */
	/* -------------------------------------------- */

	/**
	 * Prepare an object of chat data used to display a card for the Item in the chat log
	 * @param {Object} htmlOptions    Options used by the TextEditor.enrichHTML function
	 * @return {Object}               An object of chat data to render
	 */
	getChatData(htmlOptions) {
		const data = duplicate(this.data.data);
		const labels = this.labels;

		// Rich text description
		data.description.value = TextEditor.enrichHTML(data.description.value, htmlOptions);
		data.description.special = TextEditor.enrichHTML(data.description.special, htmlOptions);

		// Item type specific properties
		const props = [];
		const fn = this[`_${this.data.type}ChatData`];
		if ( fn ) fn.bind(this)(data, labels, props);

		// General equipment properties
		// if ( data.hasOwnProperty("equipped") && !["loot", "tool"].includes(this.data.type) ) {
		// 	props.push(
		// 		data.equipped ? "Equipped" : "Not Equipped",
		// 		data.proficient ? "Proficient": "Not Proficient",
		// 	);
		// }

		// Ability activation properties
		// if ( data.hasOwnProperty("activation")) {
		// 	props.push(
		// 		labels.target,
		// 		labels.activation,
		// 		labels.range,
		// 		labels.duration
		// 	);
		// }

		if( this.type == "weapon") {
			for( let [key, value] of Object.entries(COC7["weaponProperties"]))
			{
				if(this.data.data.properties[key] == true) props.push(value);
			}
		}

		if( this.type == "skill") {
			for( let [key, value] of Object.entries(COC7["skillProperties"]))
			{
				if(this.data.data.properties[key] == true) props.push(value);
			}
		}

		// Filter properties and return
		data.properties = props.filter(p => !!p);
		return data;
	}

	canBePushed(){
		if( this.type == "skill" && this.data.data.properties.push ) return true;
		return false;
	}

	weaponDamageCard( critical = false){
		let foo = "poo";

	}

	get impale(){
		return this.data.data.properties.impl;
	}
}