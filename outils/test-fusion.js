// vérifie la fusion des listes et des réactions (fonctions lues dans app.js). Lancer : node outils/test-fusion.js app.js
const fs=require('fs'),assert=require('assert');
const s=fs.readFileSync(process.argv[2],'utf8');
const a=s.indexOf('const okIt='),b=s.indexOf('const allBlocks=');
const ME='moi';eval(s.slice(a,b).replace(/^const /gm,'var ').replace(/^function fusion/m,'var fusion=function'));

// Clara coche le lait pendant que j'ajoute des œufs : rien ne se perd
const base={id:'L',nom:'Courses',at:1,items:[{id:'lait',text:'Lait',done:false,at:1}]};
const ici={...base,items:[...base.items,{id:'oeufs',text:'Œufs',done:false,at:3}]};
const enLigne={...base,items:[{id:'lait',text:'Lait',done:true,at:2}]};
const r=fusListes([ici],[enLigne]);
assert.strictEqual(r.length,1);
const it=Object.fromEntries(r[0].items.map(x=>[x.id,x]));
assert.strictEqual(it.lait.done,true,'coche de Clara gardée');
assert.ok(it.oeufs,'mon ajout gardé');
// effacement plus récent que la modif d'en face : reste effacé
const r2=fusListes([{...base,items:[{id:'lait',del:1,text:'',at:5}]}],[enLigne]);
assert.strictEqual(r2[0].items[0].del,1);
// liste supprimée ailleurs (plus récent) : supprimée ici aussi
assert.strictEqual(fusListes([base],[{...base,del:1,items:[],at:9}])[0].del,1);
// données abîmées ignorées
assert.strictEqual(fusion([null,{x:1}],'pas un tableau').length,0);

// réactions : la mienne vient d'ici, celles des autres d'en ligne
const blk={id:'b',title:'Ciné'};
const out=avecReacs([{...blk,reac:{moi:'👍',clara:'😂'}}],[{...blk,reac:{moi:'❤️'}}],[{...blk,reac:{moi:'👍',clara:'🙏'}}]);
assert.deepStrictEqual(out[0].reac,{clara:'🙏',moi:'❤️'});
// j'ai retiré ma réaction ici : elle ne revient pas d'en ligne
assert.deepStrictEqual(avecReacs([{...blk,reac:{moi:'👍'}}],[blk],[{...blk,reac:{moi:'👍'}}])[0].reac,undefined);
console.log('fusion OK');
