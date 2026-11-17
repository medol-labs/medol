import type {EmModel} from './model';
import {allContextSlices} from './dslParser';
export interface AgentAssistanceContract {
 context: 'AgentAssistance';
 assistants: Array<{name:string;mode:'chat'|'operator'|'bi';bindings:Array<{kind:'query'|'command';context:string;element:string;confirmation:'required'|'none'}>}>;
}
export function resolveAgentAssistance(model:EmModel):AgentAssistanceContract|undefined {
 const imports=model.capabilityImports?.filter(i=>i.name==='AgentAssistance') ?? [];
 if(!imports.length)return undefined;
 const extensions=model.capabilityExtensions.filter(e=>imports.some(i=>e.target===i.name || e.target===i.alias));
 const providers=extensions.flatMap(e=>e.providers);
 const assistants:AgentAssistanceContract['assistants']=[];
 for(const p of providers.filter(p=>p.kind==='assistant')) {
  const {name,mode}=p.mappings;
  if(p.source || Object.keys(p.mappings).some(k=>!['name','mode'].includes(k)) || !name || !['chat','operator','bi'].includes(mode))throw new Error('Agent assistant requires name and mode (chat/operator/bi), without source.');
  if(assistants.some(a=>a.name===name))throw new Error(`Duplicate assistant ${name}`);
  assistants.push({name,mode:mode as 'chat'|'operator'|'bi',bindings:[]});
 }
 for(const p of providers.filter(p=>p.kind!=='assistant')) {
  if(!['agentQuery','agentCommand'].includes(p.kind) || !p.source)throw new Error('Agent binding requires query/command from Context.Element.');
  if(Object.keys(p.mappings).some(k=>!['assistant','confirmation'].includes(k)))throw new Error('Unknown agent binding policy.');
  const assistant=assistants.find(a=>a.name===p.mappings.assistant);
  if(!assistant)throw new Error('Agent binding references an undeclared assistant.');
  const matches=model.contexts.flatMap(c=>allContextSlices(c).flatMap(s=>s.elements.filter(e=>e.kind===(p.kind==='agentQuery'?'readmodel':'command') && `${c.name}.${e.name}`===p.source).map(e=>({context:c.name,element:e.name}))));
  if(matches.length!==1)throw new Error(`Agent binding ${p.source} must resolve to one modeled ${p.kind}.`);
  const confirmation=p.mappings.confirmation ?? (p.kind==='agentCommand'?'required':'none');
  if(!['required','none'].includes(confirmation) || (p.kind==='agentCommand' && (assistant.mode!=='operator' || confirmation!=='required')))throw new Error('Agent commands require operator mode and mandatory confirmation.');
  if(assistant.bindings.some(b=>b.kind===(p.kind==='agentCommand'?'command':'query') && `${b.context}.${b.element}`===p.source))throw new Error('Duplicate agent binding.');
  assistant.bindings.push({kind:p.kind==='agentCommand'?'command':'query',...matches[0],confirmation:confirmation as 'required'|'none'});
 }
 return {context:'AgentAssistance',assistants};
}
