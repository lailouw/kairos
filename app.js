(function(){
const START=6, END=24;
const DAYS=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const DSH=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MONTHS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
// Un profil par personne. La clé 'ehpad' = le travail à postes (Adopt chez Clara) : gardée pour ne pas toucher aux données ni au CSS.
// Une plage peut être partagée avec d'autres profils (« Partagé avec ») : elle apparaît alors dans leurs calendriers.
const PROFILS={
  // cle = la ligne « Mes données » → Créer mon mot de passe (clé publique . jeton + clés perso chiffrés par le mot de passe).
  // Vide : le mot de passe est le jeton lui-même, et pas de synchro tant que le mot de passe n'est pas créé (rien n'est envoyé en clair).
  // groupe = profils avec qui les plages 'love' sont partagées par défaut (décochable dans la plage).
  moi:{nom:'Laïlou',cle:'',groupe:'couple',store:'zephir-state',file:'zephir.json',
    SHIFTS:{
      M70:{name:'Matin',segs:[['06:30','14:30']]},
      C96:{name:'Coupé',segs:[['07:30','12:30'],['17:30','20:00']]},
      S08:{name:'Soir',segs:[['12:30','20:00']]},
      RHE:{name:'Repos',rest:1},
      RF:{name:'Repos férié',rest:1},
      RTP:{name:'Repos temps partiel',rest:1}
    },
    CATS:{
      ehpad:{name:'EHPAD',color:'#7C9CFF'},
      broflip:{name:'BroFliping',color:'#5FD4AE'},
      love:{name:'Copine & chat',color:'#F0A0C0'},
      other:{name:'Autres',color:'#E0B36A'}
    },
    PH:{broflip:'Ex : récup + annonces',love:'Ex : soirée en amoureux',other:'Ex : courses, ménage, sport'}},
  clara:{nom:'Clara',cle:'',groupe:'couple',store:'zephir-state-clara',file:'zephir-clara.json',dimRepos:1,
    // planning Adopt recopié de la feuille papier : affiché par défaut, un choix fait dans l'appli passe devant
    PLANNING:{
      '2026-11-09':'14:00-18:00','2026-11-10':'Journée','2026-11-11':'Férié','2026-11-12':'Journée','2026-11-13':'11:00-19:00','2026-11-14':'Continu',
      '2026-11-16':'Aprem','2026-11-17':'Journée','2026-11-18':'13:00-19:00','2026-11-19':'Congé','2026-11-20':'10:00-18:00','2026-11-21':'Continu',
      '2026-11-23':'Aprem','2026-11-24':'Journée','2026-11-25':'13:00-19:00','2026-11-26':'Congé','2026-11-27':'Journée','2026-11-28':'Continu'
    },
    SHIFTS:{
      Aprem:{name:'Après-midi',segs:[['14:00','19:00']]},
      'Journée':{name:'Matin + aprem',segs:[['10:00','12:30'],['14:00','19:00']]},
      Continu:{name:'Sans pause',segs:[['10:00','18:30']]},
      'Congé':{name:'Congé',rest:1},
      'Férié':{name:'Férié',rest:1},
      Repos:{name:'Repos',rest:1}
    },
    CATS:{
      ehpad:{name:'Adopt',color:'#7C9CFF'},
      love:{name:'Ensemble & chat',color:'#F0A0C0'},
      other:{name:'Autres',color:'#E0B36A'}
    },
    PH:{love:'Ex : soirée en amoureux',other:'Ex : courses, ménage, sport'}},
  // Monte Doro : 17h-22h tous les jours sauf mercredi et jeudi (modifiable jour par jour)
  marvin:{nom:'Marvin',cle:'',store:'zephir-state-marvin',file:'zephir-marvin.json',
    SEMAINE:['Soir','Soir','Soir','Repos','Repos','Soir','Soir'],
    SHIFTS:{Soir:{name:'Soir',segs:[['17:00','22:00']]},Repos:{name:'Repos',rest:1}},
    CATS:{
      ehpad:{name:'Monte Doro',color:'#7C9CFF'},
      broflip:{name:'BroFliping',color:'#5FD4AE'},
      love:{name:'Copain & chat',color:'#F0A0C0'},
      other:{name:'Autres',color:'#E0B36A'}
    },
    PH:{broflip:'Ex : récup + annonces',love:'Ex : soirée avec mon copain',other:'Ex : courses, ménage, sport'}}
};
// renommage KairOs → ZEPHIR : une seule fois, on recopie les anciennes données 'kairos-…' en 'zephir-…' (les anciennes ne sont jamais effacées)
try{if(!localStorage.getItem('zephir-migre')){for(const k of Object.keys(localStorage))if(k.startsWith('kairos-')&&localStorage.getItem('zephir-'+k.slice(7))===null)localStorage.setItem('zephir-'+k.slice(7),localStorage.getItem(k));localStorage.setItem('zephir-migre','1')}}catch(e){}
let profil=null;try{profil=localStorage.getItem('zephir-profil')}catch(e){}
if(!PROFILS[profil])profil=null; // pas encore connecté : page de connexion
const P=PROFILS[profil||'moi'],{SHIFTS,CATS,PH}=P;
const ICON_FS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
const ICON_EXIT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=k=>{const[a,b,c]=k.split('-').map(Number);return new Date(a,b-1,c)};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mondayOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const t2m=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const endMin=t=>{const v=t2m(t);return v===0?1440:v};
const m2t=m=>pad(Math.floor(m/60)%24)+':'+pad(m%60);
const hfmt=m=>{const h=Math.floor(m/60),mm=m%60;return (h===24?0:h)+'h'+(mm?pad(mm):'')};
const dur=m=>{const h=Math.floor(m/60),mm=Math.round(m%60);return h+'h'+(mm?pad(mm):'')};
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36);
const dayLabel=k=>{const d=parse(k);return DAYS[(d.getDay()+6)%7]+' '+d.getDate()+' '+MONTHS[d.getMonth()]};
const ago=ts=>{const s=(Date.now()-ts)/1000;if(s<60)return "à l'instant";if(s<3600)return 'il y a '+Math.floor(s/60)+' min';if(s<86400)return 'il y a '+Math.floor(s/3600)+' h';return 'il y a '+Math.floor(s/86400)+' j'};
const isDesk=()=>window.matchMedia('(min-width:1024px)').matches;
let toastT=null;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2600)}

/* ---------- state ---------- */
function seed(){return {v:1,updatedAt:0,shifts:{},blocks:[],ehpad:{},urgent:[]}}
function valid(s){return s&&typeof s==='object'&&s.shifts&&typeof s.shifts==='object'&&Array.isArray(s.blocks)&&Array.isArray(s.urgent)}
let state=null;
// ancienne clé 'odt-state' relue si 'zephir-state' n'existe pas encore (jamais effacée)
try{state=JSON.parse(localStorage.getItem(P.store)||(P.store==='zephir-state'?localStorage.getItem('odt-state'):null))}catch(e){}
if(!valid(state))state=seed();
if(!state.ehpad)state.ehpad={};
// plages partagées : b.qui = profils concernés (triés, moi compris). Chaque groupe de personnes (gid = 'clara_moi', 'marvin_moi'…)
// a son fichier commun : parts[gid] = { updatedAt, blocks, dirty = pas encore envoyé }
const ME=profil||'moi',PSTORE='zephir-partage-'+ME;
const groupeP=()=>Object.keys(PROFILS).filter(id=>P.groupe&&PROFILS[id].groupe===P.groupe).sort(); // partage par défaut des plages 'love'
let parts=null;try{parts=JSON.parse(localStorage.getItem(PSTORE))}catch(e){}
if(!parts||typeof parts!=='object'){parts={};try{const o=P.groupe==='couple'&&JSON.parse(localStorage.getItem('zephir-ensemble'));if(o&&Array.isArray(o.blocks))parts.clara_moi=o}catch(e){}} // ancien stockage du couple
const sjson={};for(const g in parts)sjson[g]=JSON.stringify(parts[g].blocks);
sortBlocks();persistLocal();

const allBlocks=()=>state.blocks.concat(...Object.values(parts).map(p=>p.blocks));
const catOf=c=>CATS[c]?c:'other'; // catégorie qu'un autre profil n'a pas (BroFliping chez Clara) : affichée en « Autres »
// range chaque plage au bon endroit (aussi les anciennes plages 'love' sans qui : partagées avec le groupe, comme avant)
function sortBlocks(){
  const m=new Map();Object.values(parts).forEach(p=>p.blocks.forEach(b=>m.set(b.id,b)));state.blocks.forEach(b=>m.set(b.id,b));
  const by={};state.blocks=[];
  for(const b of m.values()){
    if(!b.qui&&b.cat==='love'&&P.groupe)b.qui=groupeP();
    const g=b.qui&&b.qui.length>1&&b.qui.includes(ME)?b.qui.join('_'):null;
    if(g)(by[g]=by[g]||[]).push(b);else state.blocks.push(b);
  }
  for(const g of new Set([...Object.keys(parts),...Object.keys(by)])){
    const p=parts[g]=parts[g]||{updatedAt:0,blocks:[]};p.blocks=by[g]||[];
    const j=JSON.stringify(p.blocks);if(j!==(sjson[g]||'[]')){sjson[g]=j;p.updatedAt=Date.now();p.dirty=true}
  }
}
function persistLocal(){try{localStorage.setItem(P.store,JSON.stringify(state));localStorage.setItem(PSTORE,JSON.stringify(parts))}catch(e){setSync('err')}}
function save(){state.updatedAt=Date.now();sortBlocks();persistLocal();renderAll();schedulePush()}

/* ---------- status dot ---------- */
function setSync(s){const el=$('#sync');el.className='sync '+({nopw:'local',cle:'auth',attente:'ok'}[s]||s);el.title={ok:'Synchronisé',loading:'Synchronisation…',err:'Synchro impossible pour le moment (réessai automatique)',auth:'Jeton GitHub refusé : reconnecte la synchro',local:'Sauvegarde sur cet appareil uniquement',
  nopw:'Synchro en pause : crée ton mot de passe dans « Mes données »',cle:'Données en ligne chiffrées avec un autre mot de passe : déconnecte-toi puis reconnecte-toi',attente:'Synchronisé (plages ensemble : en attente de la clé partagée)'}[s]||''}

/* ---------- synchro en ligne (Gist GitHub privé, contenu chiffré) ---------- */
// shortcut: le dernier appareil qui enregistre gagne (updatedAt) ; 2 appareils modifiés hors ligne en même temps → le plus ancien est écrasé (copie dans 'zephir-avant-synchro'). Passer à une fusion si ça arrive souvent.
// shortcut: les plages partagées aussi (par groupe de personnes) : si vous modifiez tous les deux en même temps, la modif la plus récente gagne. Passer à une fusion plage par plage si ça arrive.
// Tout le monde partage le même jeton GitHub, donc rien n'est envoyé en clair :
// - un fichier par profil, chiffré (AES-GCM) avec la clé perso d, connue de son seul propriétaire (dans sa ligne cle, déverrouillée par son mot de passe) ;
// - un fichier par groupe de personnes qui partagent des plages, chiffré avec la clé du groupe (cles.ks[gid]), recopiée dans le fichier pour chaque membre avec sa clé publique (ECDH P-256).
// shortcut: le jeton permet quand même d'effacer ou d'abîmer le fichier d'un autre (pas de le lire). Pour l'empêcher, il faudrait un jeton par personne ou un vrai serveur.
// L'ancien Gist (en clair, avec son historique) n'est plus que lu, pour remplir un appareil neuf. À supprimer à la main quand tout le monde est passé au mot de passe.
const GH='https://api.github.com',GFILE=P.file;
const fileOf=g=>g==='clara_moi'?'zephir-ensemble.json':'zephir-ensemble-'+g+'.json'; // le couple garde son ancien fichier
const gidOfFile=n=>n==='zephir-ensemble.json'?'clara_moi':((n.match(/^zephir-ensemble-([a-z_]+)\.json$/)||[])[1]||null);
const GDESC='ZEPHIR – données chiffrées (ne pas supprimer)',OLD_DESC=['ZEPHIR – sauvegarde (ne pas supprimer)','KairOs – sauvegarde (ne pas supprimer)'];
let sync=null;try{sync=JSON.parse(localStorage.getItem('zephir-sync'))}catch(e){} // {token, g2 = Gist chiffré, gist = ancien Gist}
let cles=null;try{cles=profil&&JSON.parse(localStorage.getItem('zephir-cles-'+profil))}catch(e){} // {pub, priv, d, ks = {gid: clé du groupe}}
if(cles&&!cles.ks)cles.ks=cles.k?{clara_moi:cles.k}:{}; // ancienne clé unique du couple
let pulled=false,busy=false,pushT=null,gOk={},gKeys={};
const allOk=()=>Object.values(gOk).every(Boolean);
function saveSync(){try{sync?localStorage.setItem('zephir-sync',JSON.stringify(sync)):localStorage.removeItem('zephir-sync')}catch(e){}}
function saveCles(){try{cles?localStorage.setItem('zephir-cles-'+profil,JSON.stringify(cles)):localStorage.removeItem('zephir-cles-'+profil)}catch(e){}}
const gh=(path,opt={})=>fetch(GH+path,{...opt,cache:'no-store',headers:{Authorization:'Bearer '+sync.token,Accept:'application/vnd.github+json'}})
  .then(r=>{if(!r.ok)throw r.status;return r.json()});
async function findGist(descs,old){ // un autre appareil l'a peut-être déjà créé
  for(let p=1;p<=5;p++){const l=await gh('/gists?per_page=100&page='+p);const g=l.find(x=>descs.includes(x.description)||(old&&x.description!==GDESC&&x.files&&(x.files['zephir.json']||x.files['kairos.json'])));if(g)return g.id;if(l.length<100)break}
  return null;
}
async function readFile(g,name,old){
  const f=g.files[name]||(old&&g.files[name.replace(/^zephir/,'kairos')]);if(!f)return null;
  return JSON.parse(f.truncated?await fetch(f.raw_url,{cache:'no-store'}).then(r=>r.text()):f.content);
}
async function ancien(name){ // ancienne sauvegarde en clair, lue seulement (appareil neuf)
  try{
    if(sync.gist===undefined){sync.gist=await findGist(OLD_DESC,true);saveSync()}
    return sync.gist?await readFile(await gh('/gists/'+sync.gist),name,true):null;
  }catch(e){return null}
}

/* chiffrement */
const TE=new TextEncoder(),TD=new TextDecoder(),AES={name:'AES-GCM',length:256},ECDH={name:'ECDH',namedCurve:'P-256'};
const b64=u=>{let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const aesKey=raw=>crypto.subtle.importKey('raw',unb64(raw),'AES-GCM',false,['encrypt','decrypt']);
async function seal(k,obj){const iv=rnd(12);return {iv:b64(iv),c:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,TE.encode(JSON.stringify(obj)))))}}
async function openBox(k,box){return JSON.parse(TD.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},k,unb64(box.c))))} // erreur si mauvaise clé
// clé du groupe recopiée pour un membre : clé jetable + sa clé publique → clé d'emballage
async function wrapFor(pubB64,kRaw){
  const eph=await crypto.subtle.generateKey(ECDH,true,['deriveKey']);
  const pub=await crypto.subtle.importKey('raw',unb64(pubB64),ECDH,false,[]);
  const w=await crypto.subtle.deriveKey({name:'ECDH',public:pub},eph.privateKey,AES,false,['encrypt']);
  const iv=rnd(12);
  return {e:b64(new Uint8Array(await crypto.subtle.exportKey('raw',eph.publicKey))),iv:b64(iv),c:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},w,kRaw)))};
}
async function unwrapMine(box){
  const priv=await crypto.subtle.importKey('pkcs8',unb64(cles.priv),ECDH,false,['deriveKey']);
  const epub=await crypto.subtle.importKey('raw',unb64(box.e),ECDH,false,[]);
  const w=await crypto.subtle.deriveKey({name:'ECDH',public:epub},priv,AES,false,['decrypt']);
  return b64(new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},w,unb64(box.c))));
}
const pubOf=id=>id===profil&&cles?cles.pub:(PROFILS[id].cle.includes('.')?PROFILS[id].cle.split('.')[0]:null);
async function newCles(){
  const kp=await crypto.subtle.generateKey(ECDH,true,['deriveKey']);
  return {pub:b64(new Uint8Array(await crypto.subtle.exportKey('raw',kp.publicKey))),priv:b64(new Uint8Array(await crypto.subtle.exportKey('pkcs8',kp.privateKey))),d:b64(rnd(32))};
}

async function pull(first){
  if(!sync||!profil||busy||(sheetCtx&&!first))return; // pas de remplacement pendant qu'une fiche est ouverte
  if(!cles){setSync('nopw');return} // pas encore de mot de passe : rien en ligne
  busy=true;setSync('loading');
  try{
    if(!sync.g2){sync.g2=await findGist([GDESC]);saveSync()}
    const g=sync.g2?await gh('/gists/'+sync.g2):null;
    const f=g&&await readFile(g,GFILE);
    let r=null;
    if(f){try{r=await openBox(await aesKey(cles.d),f)}catch(e){busy=false;setSync('cle');return}} // chiffré avec une autre clé : on n'écrase rien
    else if(!state.updatedAt)r=await ancien(GFILE);
    if(!valid(r))r=null;
    let changed=false;
    if(r&&r.updatedAt>state.updatedAt){ // la version la plus récente gagne, jamais une version vide (updatedAt 0)
      try{localStorage.setItem('zephir-avant-synchro',JSON.stringify(state))}catch(e){}
      state=r;if(!state.ehpad)state.ehpad={};changed=true;
    }
    gOk={};
    const mes=new Set(Object.keys(parts));
    if(g)for(const n in g.files){const gid=gidOfFile(n);if(gid&&gid.split('_').includes(profil))mes.add(gid)}
    for(const gid of mes){
      const name=fileOf(gid),fs=g&&await readFile(g,name),k0=cles.ks[gid];
      const p=parts[gid]||(parts[gid]={updatedAt:0,blocks:[]});let rs=null;
      if(fs){
        const keys=gKeys[gid]=fs.keys||{};
        if(keys[profil]){try{cles.ks[gid]=await unwrapMine(keys[profil])}catch(e){}}
        if(cles.ks[gid]){try{rs=await openBox(await aesKey(cles.ks[gid]),fs)}catch(e){}}
        gOk[gid]=!!rs; // sinon : on attend qu'un autre membre nous ajoute, sans rien envoyer
        if(rs&&gid.split('_').some(id=>pubOf(id)&&!keys[id]))p.dirty=true; // un membre à ajouter
        // clé reçue (ou changée) : on réunit les plages d'ici et celles en ligne, sans rien perdre
        if(rs&&cles.ks[gid]!==k0&&Array.isArray(rs.blocks)){const m=new Map(rs.blocks.map(x=>[x.id,x]));p.blocks.forEach(x=>m.set(x.id,x));
          rs={updatedAt:Date.now(),blocks:[...m.values()]};if(p.blocks.length)p.dirty=true}
      }else{
        gKeys[gid]={};if(!p.updatedAt)rs=await ancien(name);
        if(!cles.ks[gid])cles.ks[gid]=b64(rnd(32));
        gOk[gid]=true;if(p.blocks.length||rs)p.dirty=true;
      }
      if(rs&&Array.isArray(rs.blocks)&&rs.updatedAt>p.updatedAt){parts[gid]={updatedAt:rs.updatedAt,blocks:rs.blocks,dirty:p.dirty};sjson[gid]=JSON.stringify(rs.blocks);changed=true}
    }
    saveCles();
    if(changed){sortBlocks();persistLocal();renderAll()}
    pulled=true;busy=false;
    if(!f||!r||state.updatedAt>r.updatedAt||Object.keys(parts).some(gid=>gOk[gid]&&parts[gid].dirty))return push();
    setSync(allOk()?'ok':'attente');
  }catch(e){busy=false;setSync(e===401?'auth':'err')}
}
async function push(){
  if(!sync||!pulled||!cles)return; // jamais d'envoi avant d'avoir lu la version en ligne
  if(busy)return schedulePush();
  if(Object.keys(parts).some(gid=>parts[gid].dirty&&!(gid in gOk)))return pull(true); // nouveau partage : lire d'abord son fichier en ligne
  busy=true;setSync('loading');
  try{
    const body={description:GDESC,files:{[GFILE]:{content:JSON.stringify({v:2,...await seal(await aesKey(cles.d),state)})}}};
    // un fichier de groupe n'est envoyé que s'il a changé ici, pour ne pas écraser une modif d'un autre
    const envois=[];
    for(const gid in parts){
      const p=parts[gid],k=cles.ks[gid];if(!gOk[gid]||!p.dirty||!k)continue;
      const kRaw=unb64(k),keys={...gKeys[gid]};
      for(const id of gid.split('_')){const pk=pubOf(id);if(pk)keys[id]=await wrapFor(pk,kRaw)}
      gKeys[gid]=keys;
      body.files[fileOf(gid)]={content:JSON.stringify({v:2,keys,...await seal(await aesKey(k),{updatedAt:p.updatedAt,blocks:p.blocks})})};
      envois.push([gid,p.updatedAt]);
    }
    if(sync.g2)await gh('/gists/'+sync.g2,{method:'PATCH',body:JSON.stringify(body)});
    else{sync.g2=(await gh('/gists',{method:'POST',body:JSON.stringify({...body,public:false})})).id;saveSync()}
    envois.forEach(([gid,at])=>{if(parts[gid].updatedAt===at)parts[gid].dirty=false});if(envois.length)persistLocal();
    busy=false;setSync(allOk()?'ok':'attente');
  }catch(e){
    busy=false;
    if(e===404){sync.g2=null;saveSync();return push()} // gist supprimé : on en recrée un
    setSync(e===401?'auth':'err');
  }
}
// copie gardée avant une synchro ou un import ; on ne propose que celles qui contiennent quelque chose
function backupOf(){for(const k of ['zephir-avant-synchro','zephir-avant-import']){try{const d=JSON.parse(localStorage.getItem(k));if(valid(d)&&(d.blocks.length||Object.keys(d.shifts).length||d.urgent.length))return d}catch(e){}}return null}
function schedulePush(){clearTimeout(pushT);pushT=setTimeout(push,1500)}
async function checkToken(token){
  sync={token};
  try{await gh('/gists?per_page=1');saveSync();return true}catch(e){sync=null;$('#syncErr').textContent=e===401?'Jeton refusé par GitHub.':e===403?"Ce jeton n'a pas le droit « Gists ».":'Connexion à GitHub impossible.';return false}
}
async function connect(token){
  if(!await checkToken(token))return;
  pulled=false;await pull(true);closeSheet();toast(cles?'Synchro activée ✓':'Jeton enregistré : crée ton mot de passe pour lancer la synchro');
}
/* ligne cle : clé publique . base64(sel 16 | iv 12 | chiffré) ; le chiffré = {t: jeton, x: clé privée, d: clé perso}, clé tirée du mot de passe (PBKDF2) */
async function keyFrom(pw,salt){
  const k=await crypto.subtle.importKey('raw',TE.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},k,AES,false,['encrypt','decrypt']);
}
async function lock(obj,pw){
  const salt=rnd(16),iv=rnd(12);
  const c=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFrom(pw,salt),TE.encode(JSON.stringify(obj))));
  return b64(new Uint8Array([...salt,...iv,...c]));
}
async function unlock(cle,pw){ // null si mauvais mot de passe
  try{const d=unb64(cle.split('.').pop());return JSON.parse(TD.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:d.slice(16,28)},await keyFrom(pw,d.slice(0,16)),d.slice(28))))}catch(e){return null}
}
async function login(nom,pw){
  const simple=s=>s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); // « lailou » = « Laïlou »
  const p=Object.keys(PROFILS).find(id=>simple(PROFILS[id].nom)===simple(nom));
  if(!p){$('#syncErr').textContent='Prénom inconnu.';return}
  if(!pw){$('#syncErr').textContent='Mot de passe manquant.';return}
  const c=PROFILS[p].cle;let token=pw,u=null;
  if(c){$('#syncErr').textContent='Vérification…';u=await unlock(c,pw);if(!u){$('#syncErr').textContent='Mot de passe incorrect.';return}token=u.t}
  if(!await checkToken(token))return;
  try{
    localStorage.setItem('zephir-profil',p);
    if(u){let old=null;try{old=JSON.parse(localStorage.getItem('zephir-cles-'+p))}catch(e){}
      localStorage.setItem('zephir-cles-'+p,JSON.stringify({pub:c.split('.')[0],priv:u.x,d:u.d,ks:old&&old.d===u.d?(old.ks||(old.k?{clara_moi:old.k}:undefined)):undefined}))}
  }catch(e){}
  location.reload(); // tout repart avec les catégories et les données du profil choisi
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pull()});
window.addEventListener('online',()=>pull());

/* ---------- export / import ---------- */
function exportData(){
  const blob=new Blob([JSON.stringify({...state,blocks:allBlocks()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='zephir-sauvegarde-'+key(new Date())+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('Sauvegarde téléchargée');
}
let importing=null;
function readImport(file){
  const r=new FileReader();
  r.onload=()=>{
    let d=null;try{d=JSON.parse(r.result)}catch(e){}
    if(d&&d.state&&!d.shifts)d=d.state; // format de la base Claude : {state:{…}}
    if(!valid(d)){$('#impErr').textContent="Ce fichier n'est pas une sauvegarde ZEPHIR.";return}
    importing=d;
    $('#impInfo').innerHTML=`Fichier : <b>${Object.keys(d.shifts).length}</b> postes, <b>${d.blocks.length}</b> plages, <b>${d.urgent.length}</b> urgents.<br>Il va <b>remplacer</b> les données de cet appareil.`;
    $('#impGo').hidden=false;$('#impErr').textContent='';
  };
  r.readAsText(file);
}
function applyImport(){
  if(!importing)return;
  try{localStorage.setItem('zephir-avant-import',JSON.stringify(state))}catch(e){} // filet de sécurité
  state=JSON.parse(JSON.stringify(importing));importing=null;
  if(!state.ehpad)state.ehpad={};
  delete state.imports;
  save();closeSheet();toast('Données importées ✓');
}
function openData(){
  importing=null;
  openSheet(`<div class="sh-head"><span class="tag t-ehpad">Mes données</span><button class="x" data-act="close" aria-label="Fermer">×</button></div>
    <h2>Sauvegarde</h2><p class="meta">Tes données sont enregistrées sur cet appareil. Garde une copie de secours de temps en temps.</p>
    <div class="sh-foot"><button class="btn" data-act="export">↓ Exporter</button><label class="btn ghost" style="text-align:center;cursor:pointer">↑ Importer<input type="file" accept=".json,application/json" id="impFile" hidden></label></div>
    <p class="meta" id="impInfo" style="margin-top:14px"></p><div class="err" id="impErr"></div>
    <div class="sh-foot"><button class="btn danger" data-act="importGo" id="impGo" hidden>Remplacer mes données</button></div>
    <h2 style="margin-top:22px">Synchro en ligne</h2>
    ${sync?`<p class="meta">Connecté à GitHub : tes données passent d'un appareil à l'autre.</p>
    <div class="sh-foot"><button class="btn ghost" data-act="syncNow">Synchroniser</button><button class="btn danger" data-act="syncOff">Déconnecter</button></div>`
    :`<p class="meta">Colle ton jeton GitHub (droit « Gists » seulement), le même sur chaque appareil. La version la plus récente (en ligne ou sur cet appareil) est gardée, l'autre est mise de côté.</p>
    <form class="addrow" data-form="syncOn"><input name="t" type="password" placeholder="github_pat_…" autocomplete="off"><button>Connecter</button></form>`}
    <div class="err" id="syncErr"></div>
    ${sync&&P.cle&&!cles?`<h2 style="margin-top:22px">Mot de passe</h2><p class="meta">Ton mot de passe existe déjà : déconnecte-toi puis reconnecte-toi avec lui pour reprendre la synchro.</p>`
    :sync?`<h2 style="margin-top:22px">Mot de passe</h2><p class="meta">${cles?'':'<b>Synchro en pause tant que tu n\'as pas de mot de passe.</b> '}Choisis ton mot de passe (10 caractères minimum) : tes données en ligne seront chiffrées avec, personne d'autre ne pourra les lire. Envoie la ligne obtenue à Laïlou pour qu'elle soit mise dans l'appli. Garde ton mot de passe : sans lui, la copie en ligne est perdue.</p>
    <form class="addrow" data-form="mkPw"><input name="a" type="password" placeholder="Mot de passe" minlength="10" autocomplete="new-password" required><input name="b" type="password" placeholder="Encore une fois" autocomplete="new-password" required><button>Créer</button></form>
    <div class="err" id="pwErr"></div><input class="inp" id="pwOut" readonly hidden style="margin-top:10px">`:''}
    <div class="sh-foot"><button class="btn ghost" data-act="logout">Changer de profil (${esc(P.nom)})</button></div>
    ${backupOf()?`<div class="sh-foot"><button class="btn ghost" data-act="restore">↺ Revenir à la version d'avant (${backupOf().blocks.length} plages)</button></div>`:''}`,{kind:'data'});
}

/* ---------- planning ---------- */
let curMon=mondayOf(new Date());
let tab='plan';
// poste du jour : un code de SHIFTS, ou des heures du jour 'HH:MM-HH:MM' ; dimanche = Repos si rien n'est mis (profil dimRepos)
// ordre : choix fait dans l'appli ('' = « Pas encore connu » choisi exprès) > planning papier (P.PLANNING) > dimanche Repos
// P.SEMAINE = poste habituel par jour de la semaine (0 = dimanche), après le planning papier
const defOf=k=>(P.PLANNING&&P.PLANNING[k])||(P.SEMAINE&&P.SEMAINE[parse(k).getDay()])||(P.dimRepos&&parse(k).getDay()===0?'Repos':'');
const codeOf=k=>k in state.shifts?state.shifts[k]:defOf(k);
const isHours=c=>/^\d\d:\d\d-\d\d:\d\d$/.test(c||'');
const shOf=c=>SHIFTS[c]||(isHours(c)?{name:'Heures du jour',segs:[c.split('-')]}:null);
const codeLbl=c=>isHours(c)?hfmt(t2m(c.slice(0,5)))+'-'+hfmt(endMin(c.slice(6))):c;

function itemsForDay(k){
  const out=[];
  const code=codeOf(k),sh=shOf(code);
  const ex=state.ehpad[k]||{};
  if(sh&&sh.segs)sh.segs.forEach(s=>out.push({type:'ehpad',cat:'ehpad',date:k,s:t2m(s[0]),e:endMin(s[1]),title:CATS.ehpad.name,code,imp:!!ex.imp,tasks:ex.tasks||[]}));
  allBlocks().filter(b=>b.date===k).forEach(b=>out.push({type:'block',cat:catOf(b.cat),id:b.id,date:k,s:t2m(b.start),e:endMin(b.end),title:b.cat==='broflip'?'BroFliping':(b.title||CATS[catOf(b.cat)].name),imp:!!b.imp,tasks:b.tasks||[]}));
  return out.sort((a,b)=>a.s-b.s||b.e-a.e);
}
function layout(items){
  let group=[],lanes=[],end=-1;
  const close=()=>{const n=lanes.length;group.forEach(it=>it.n=n);group=[];lanes=[]};
  for(const it of items){
    if(group.length&&it.s>=end)close();
    let l=lanes.findIndex(e=>e<=it.s);
    if(l<0){l=lanes.length;lanes.push(it.e)}else lanes[l]=it.e;
    it.lane=l;group.push(it);end=Math.max(end,it.e);
  }
  if(group.length)close();
}
function blockHTML(it){
  const s=Math.max(it.s,START*60),e=Math.min(it.e,END*60);if(e<=s)return'';
  const top=(s-START*60)/60,h=(e-s)/60,w=100/it.n,left=it.lane*w;
  const done=it.tasks.filter(t=>t.done).length;
  const prog=it.tasks.length&&h>=1.5?`<span class="prog">✓ ${done}/${it.tasks.length}</span>`:'';
  return `<div class="blk c-${it.cat}${it.imp?' has-imp':''}${h<1?' short':''}" style="top:calc(${top} * var(--h) + 1px);height:calc(${h} * var(--h) - 2px);left:calc(${left}% + 2px);width:calc(${w}% - 4px)" data-act="open" data-type="${it.type}" data-k="${it.date}" data-id="${it.id||''}">${it.imp?'<span class="imp" title="Important"></span>':''}<span class="bt">${esc(it.title)}</span><span class="bh">${hfmt(it.s)}–${hfmt(it.e)}</span>${prog}</div>`;
}
function weekDays(){return [...Array(7)].map((_,i)=>addDays(curMon,i))}
function renderPlan(){
  const days=weekDays(),tk=key(new Date());
  const d1=days[0],d7=days[6];
  $('#wkLabel').textContent=d1.getDate()+(d1.getMonth()!==d7.getMonth()?' '+MONTHS[d1.getMonth()]:'')+' – '+d7.getDate()+' '+MONTHS[d7.getMonth()]+' '+d7.getFullYear();
  const head='<div></div>'+days.map((d,i)=>{
    const k=key(d),c=codeOf(k),sh=shOf(c);
    const chip=c?`<span class="chip ${sh&&sh.rest?'rest':'work'}">${sh&&sh.rest?'Repos':esc(codeLbl(c))}</span>`:'<span class="chip none">—</span>';
    return `<button class="dh${k===tk?' is-today':''}" data-act="shift" data-k="${k}"><span class="dn">${DSH[i]}</span><span class="dd">${d.getDate()}</span>${chip}</button>`;
  }).join('');
  let times='';for(let h=START;h<END;h++)times+=`<div class="tl" style="top:calc(${h-START} * var(--h))">${h}h</div>`;
  const now=new Date(),nm=now.getHours()*60+now.getMinutes();
  const cols=days.map(d=>{
    const k=key(d),items=itemsForDay(k);layout(items);
    const nowLine=(k===tk&&nm>=START*60)?`<div class="now" style="top:calc(${(nm-START*60)/60} * var(--h))"></div>`:'';
    return `<div class="col${k===tk?' is-today':''}" data-k="${k}">${items.map(blockHTML).join('')}${nowLine}</div>`;
  }).join('');
  $('#grid').innerHTML=`<div class="ghead">${head}</div><div class="gbody"><div class="times">${times}</div>${cols}</div>`;
  fitHeight();
  renderStats();
}

/* hours panel */
function renderStats(){
  const days=weekDays();
  const t=Object.fromEntries(Object.keys(CATS).map(c=>[c,0]));
  days.forEach(d=>itemsForDay(key(d)).forEach(it=>t[it.cat]+=it.e-it.s));
  const tot=Object.values(t).reduce((a,b)=>a+b,0);
  $('#pStats').innerHTML=`<h3><span>Heures de la semaine</span><em>${dur(tot)}</em></h3>
    <div class="bar">${Object.keys(CATS).map(c=>t[c]?`<i style="width:${t[c]/tot*100}%;background:${CATS[c].color}"></i>`:'').join('')}</div>
    <div class="st">${Object.keys(CATS).map(c=>`<div><span><i style="background:${CATS[c].color}"></i>${CATS[c].name}</span><b>${dur(t[c])}<em>${tot?Math.round(t[c]/tot*100):0}%</em></b></div>`).join('')}</div>`;
}

/* now / next panel */
function renderNow(){
  const now=new Date(),tk=key(now),nm=now.getHours()*60+now.getMinutes();
  const items=itemsForDay(tk);
  const cur=items.filter(it=>it.s<=nm&&nm<it.e);
  let next=items.find(it=>it.s>nm),nextDay='';
  if(!next){for(let i=1;i<=7&&!next;i++){const k=key(addDays(now,i)),its=itemsForDay(k);if(its.length){next=its[0];nextDay=i===1?'Demain':DAYS[(addDays(now,i).getDay()+6)%7]}}}
  const row=(it,lbl)=>`<button class="nrow" data-act="open" data-type="${it.type}" data-k="${it.date}" data-id="${it.id||''}"><i style="background:${CATS[it.cat].color}"></i><div><small>${lbl}</small><b>${it.imp?'<span class="impdot"></span>':''}${esc(it.type==='ehpad'?CATS.ehpad.name+' · '+codeLbl(it.code):it.title)}</b></div><span>${hfmt(it.s)}–${hfmt(it.e)}</span></button>`;
  let html='<h3><span>Maintenant</span></h3><div class="nowc">';
  html+=cur.length?cur.map(it=>row(it,'En cours')).join(''):'<div class="nrow free">Temps libre</div>';
  if(next)html+=row(next,nextDay?'Ensuite · '+nextDay:'Ensuite');
  html+='</div>';
  $('#pNow').innerHTML=html;
}

/* ---------- urgent ---------- */
function urgListHTML(){
  const open=state.urgent.filter(u=>!u.done).sort((a,b)=>b.at-a.at);
  const done=state.urgent.filter(u=>u.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
  const li=u=>`<li class="${u.done?'done':''}"><button class="ck" data-act="ckUrg" data-id="${u.id}">${u.done?'✓':''}</button><div class="txt"><span>${esc(u.text)}</span><small>${ago(u.at)}</small></div><button class="del" data-act="delUrg" data-id="${u.id}" aria-label="Supprimer">×</button></li>`;
  let html='';
  if(!open.length&&!done.length)html+=`<div class="empty-u"><b>✓</b>Rien d'urgent pour l'instant.</div>`;
  else{
    html+=open.length?`<ul class="ulist">${open.map(li).join('')}</ul>`:`<div class="empty-u" style="padding:18px"><b>✓</b>Tout est fait.</div>`;
    if(done.length)html+=`<div class="usec"><span>Fait (${done.length})</span><button data-act="clearUrg">Tout effacer</button></div><ul class="ulist">${done.map(li).join('')}</ul>`;
  }
  return {html,open:open.length};
}
function renderUrg(){
  const {html,open}=urgListHTML();
  $('#badge').textContent=open||'';
  $('#vUrg').innerHTML=`<div class="uhead"><h1><i></i>Urgent</h1><p>Les petits trucs à faire vite, sans horaire. Appuie sur + pour en noter un.</p></div>${html}`;
  const p=$('#pUrg');
  const ae=document.activeElement,keep=ae&&ae.closest&&ae.closest('#pUrg')&&ae.name==='t';
  const draft=keep?ae.value:'';
  p.innerHTML=`<h3><span><span class="dot"></span>Urgents</span><em>${open?open+' à faire':''}</em></h3>
    <form class="addrow" data-form="addUrgInline"><input name="t" placeholder="Noter un truc urgent…" autocomplete="off" maxlength="200"><button>+</button></form>
    <div class="urgscroll">${html}</div>`;
  if(keep){const i=p.querySelector('input[name=t]');i.value=draft;i.focus()}
}

function renderAll(){renderPlan();renderNow();renderUrg()}

/* ---------- fit grid to screen height (desktop) ---------- */
function fitHeight(){
  const root=document.documentElement;
  if(!isDesk()){root.style.removeProperty('--h');return}
  const g=$('#grid'),hd=g&&g.querySelector('.ghead');if(!hd)return;
  const avail=g.clientHeight-hd.offsetHeight-2;
  const h=Math.max(22,Math.floor(avail/(END-START)*10)/10);
  root.style.setProperty('--h',h+'px');
}

/* ---------- clock ---------- */
function tickClock(){
  const d=new Date();
  $('#clkT').innerHTML=pad(d.getHours())+':'+pad(d.getMinutes())+'<s>'+pad(d.getSeconds())+'</s>';
  $('#clkD').textContent=DAYS[(d.getDay()+6)%7].toLowerCase()+' '+d.getDate()+' '+MONTHS[d.getMonth()];
}

/* ---------- fullscreen ---------- */
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsOK=!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
function fsIcon(){$('#fsBtn').innerHTML=fsEl()?ICON_EXIT:ICON_FS;$('#fsBtn').title=fsEl()?'Quitter le plein écran':'Plein écran'}
async function toggleFS(){
  try{
    if(fsEl()){await (document.exitFullscreen||document.webkitExitFullscreen).call(document)}
    else{const el=document.documentElement;const r=(el.requestFullscreen||el.webkitRequestFullscreen).call(el);if(r&&r.then)await r}
  }catch(e){toast("Le plein écran n'est pas autorisé ici. Essaie la touche F11.")}
  setTimeout(fsIcon,50);
}
if(!fsOK)$('#fsBtn').hidden=true;
document.addEventListener('fullscreenchange',()=>{fsIcon();setTimeout(fitHeight,60)});
document.addEventListener('webkitfullscreenchange',()=>{fsIcon();setTimeout(fitHeight,60)});

/* ---------- sheet ---------- */
let sheetCtx=null;
function openSheet(html,ctx){sheetCtx=ctx||null;const s=$('#sheet');s.innerHTML=html;s.classList.add('on');$('#ov').classList.add('on')}
function closeSheet(){sheetCtx=null;$('#sheet').classList.remove('on');$('#ov').classList.remove('on')}

function refOf(type,k,id,create){
  if(type==='ehpad'){if(!state.ehpad[k]){if(!create)return{imp:false,tasks:[]};state.ehpad[k]={imp:false,tasks:[]}}return state.ehpad[k]}
  return allBlocks().find(b=>b.id===id);
}
function openDetails(type,k,id,focus){
  const ref=refOf(type,k,id,false);if(!ref)return closeSheet();
  let cat,title,time;
  if(type==='ehpad'){
    const c=codeOf(k),sh=shOf(c);if(!sh||!sh.segs)return closeSheet();
    cat='ehpad';title=`${CATS.ehpad.name} · ${codeLbl(c)} (${sh.name})`;
    time=sh.segs.map(s=>hfmt(t2m(s[0]))+' – '+hfmt(endMin(s[1]))).join(' et ');
  }else{cat=catOf(ref.cat);title=ref.title||CATS[cat].name;time=hfmt(t2m(ref.start))+' – '+hfmt(endMin(ref.end));
    const avec=(ref.qui||[]).filter(id=>id!==ME&&PROFILS[id]).map(id=>PROFILS[id].nom);if(avec.length)time+=' · avec '+avec.join(' et ')}
  const tasks=ref.tasks||[],done=tasks.filter(t=>t.done).length;
  const html=`<div class="sh-head"><span class="tag t-${cat}">${CATS[cat].name}</span><button class="x" data-act="close" aria-label="Fermer">×</button></div>
    <h2>${esc(title)}</h2><p class="meta">${dayLabel(k)} · ${time}</p>
    <button class="impbtn${ref.imp?' on':''}" data-act="toggleImp"><span class="impdot"></span>${ref.imp?'Important':'Marquer comme important'}</button>
    <div class="tasks-h"><span>À faire</span><span>${done}/${tasks.length}</span></div>
    <ul class="tasks">${tasks.map(t=>`<li class="${t.done?'done':''}"><button class="ck" data-act="ckTask" data-tid="${t.id}">${t.done?'✓':''}</button><span>${esc(t.text)}</span><button class="del" data-act="delTask" data-tid="${t.id}" aria-label="Supprimer">×</button></li>`).join('')||`<li class="empty">Rien de prévu pour l'instant. Ajoute ce que tu dois faire ci-dessous.</li>`}</ul>
    <form class="addrow" data-form="addTask"><input name="t" placeholder="Ajouter une tâche…" autocomplete="off" maxlength="200"><button>Ajouter</button></form>
    <div class="sh-foot">${type==='ehpad'?`<button class="btn ghost" data-act="shift" data-k="${k}">Changer le poste du jour</button>`:`<button class="btn ghost" data-act="edit">Modifier</button><button class="btn danger" data-act="delBlock">Supprimer</button>`}</div>`;
  openSheet(html,{kind:'details',type,k,id});
  if(focus){const i=$('#sheet input[name=t]');if(i)i.focus()}
}

function openEditor(opts){
  const b=opts.id?allBlocks().find(x=>x.id===opts.id):null;
  const bc=Object.keys(CATS).filter(c=>c!=='ehpad');
  const v=b?{...b}:{cat:bc[0],title:'',date:opts.date,start:opts.start,end:opts.end,imp:false};
  const mon=mondayOf(parse(v.date));
  const dayOpts=[...Array(7)].map((_,i)=>{const k=key(addDays(mon,i));return `<option value="${k}"${k===v.date?' selected':''}>${dayLabel(k)}</option>`}).join('');
  const qui=v.qui||(v.cat==='love'?groupeP():[]);
  const avec=Object.keys(PROFILS).filter(id=>id!==ME).map(id=>`<label><input type="checkbox" name="qui" value="${id}"${qui.includes(id)?' checked':''}><span class="pill">${esc(PROFILS[id].nom)}</span></label>`).join('');
  const pills=bc.map(c=>`<label><input type="radio" name="cat" value="${c}"${v.cat===c?' checked':''}><span class="pill"><i style="background:${CATS[c].color}"></i>${CATS[c].name}</span></label>`).join('');
  const html=`<div class="sh-head"><span class="tag t-${v.cat}" id="edTag">${b?'Modifier la plage':'Nouvelle plage'}</span><button class="x" data-act="close" aria-label="Fermer">×</button></div>
    <form data-form="saveBlock">
      <div class="field"><span class="lbl">Catégorie</span><div class="pills">${pills}</div></div>
      <div class="field"><span class="lbl">Titre</span><input class="inp" name="title" value="${esc(v.title)}" placeholder="${PH[v.cat]||''}" maxlength="60" autocomplete="off"></div>
      <div class="field"><span class="lbl">Partagé avec</span><div class="pills">${avec}</div></div>
      <div class="field"><span class="lbl">Jour</span><select class="inp" name="date">${dayOpts}</select></div>
      <div class="field row2"><div><span class="lbl">Début</span><input class="inp" type="time" name="start" step="900" value="${v.start}" required></div><div><span class="lbl">Fin</span><input class="inp" type="time" name="end" step="900" value="${v.end}" required></div></div>
      <label class="toggle"><input type="checkbox" name="imp"${v.imp?' checked':''}><span>C'est important</span></label>
      <div class="err" id="edErr"></div>
      <div class="sh-foot"><button type="button" class="btn ghost" data-act="close">Annuler</button><button class="btn">${b?'Enregistrer':'Créer la plage'}</button></div>
    </form>`;
  openSheet(html,{kind:'editor',id:b?b.id:null});
}

function openShift(k){
  const cur=codeOf(k),hrs=isHours(cur)?cur.split('-'):['',''];
  const btn=(code)=>{const s=SHIFTS[code];const sub=s.segs?s.segs.map(x=>hfmt(t2m(x[0]))+'–'+hfmt(t2m(x[1]))).join(' / '):'Pas de travail';
    return `<button class="shb ${s.segs?'work':''}${cur===code?' on':''}" data-act="setShift" data-k="${k}" data-code="${esc(code)}"><b>${esc(code)}</b><small>${s.name} · ${sub}</small></button>`};
  const html=`<div class="sh-head"><span class="tag t-ehpad">Poste ${esc(CATS.ehpad.name)}</span><button class="x" data-act="close" aria-label="Fermer">×</button></div>
    <h2>${dayLabel(k)}</h2><p class="meta">Choisis ton poste pour ce jour.</p>
    <div class="shgrid">${Object.keys(SHIFTS).map(btn).join('')}<button class="shb wide${!cur?' on':''}" data-act="setShift" data-k="${k}" data-code="">Pas encore connu</button></div>
    <p class="meta" style="margin-top:14px">Autres heures ce jour-là :</p>
    <form class="addrow" data-form="setHours"><input type="time" name="s" step="900" value="${hrs[0]}" required><input type="time" name="e" step="900" value="${hrs[1]}" required><button>OK</button></form>
    <div class="err" id="hrsErr"></div>`;
  openSheet(html,{kind:'shift',k});
}

function openUrgAdd(){
  openSheet(`<div class="sh-head"><span class="tag t-urg">Urgent</span><button class="x" data-act="close" aria-label="Fermer">×</button></div>
    <h2>Noter un truc urgent</h2>
    <form class="addrow" data-form="addUrg" style="margin-top:14px"><input name="t" placeholder="Ex : vite aller chercher des croquettes" autocomplete="off" maxlength="200"><button>Ajouter</button></form>`,{kind:'urg'});
  setTimeout(()=>{const i=$('#sheet input[name=t]');if(i)i.focus()},280);
}

function defaultSlot(){
  const days=weekDays().map(key),tk=key(new Date());
  const date=days.includes(tk)?tk:days[0];
  let h=new Date().getHours()+1;if(date!==tk)h=18;
  h=Math.min(Math.max(h,START),22);
  return {date,start:pad(h)+':00',end:pad(h+1)+':00'};
}

function setTab(t){
  tab=t;
  document.body.classList.toggle('t-urg',t==='urg');
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  $('#vPlan').hidden=t!=='plan';$('#vUrg').hidden=t!=='urg';
  $('#wkNav').hidden=t!=='plan';$('#todayBtn').hidden=t!=='plan';$('#urgTitle').hidden=t!=='urg';
  $('#fab').classList.toggle('urg',t==='urg');
  if(t==='urg')renderUrg();else fitHeight();
  window.scrollTo({top:0});
}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const tb=e.target.closest('[data-tab]');if(tb){setTab(tb.dataset.tab);return}
  const a=e.target.closest('[data-act]');
  if(!a){
    const col=e.target.closest('.col');
    if(col){
      const hpx=col.getBoundingClientRect().height/(END-START);
      const y=e.clientY-col.getBoundingClientRect().top;
      let m=START*60+Math.floor(y/hpx*2)*30;m=Math.min(m,END*60-60);
      openEditor({date:col.dataset.k,start:m2t(m),end:m2t(m+60)});
    }
    return;
  }
  const act=a.dataset.act,c=sheetCtx;
  switch(act){
    case 'enter':{const s=$('#splash');s.classList.add('out');break}
    case 'prev':curMon=addDays(curMon,-7);renderPlan();break;
    case 'next':curMon=addDays(curMon,7);renderPlan();break;
    case 'today':curMon=mondayOf(new Date());renderPlan();break;
    case 'fs':toggleFS();break;
    case 'close':closeSheet();break;
    case 'data':openData();break;
    case 'export':exportData();break;
    case 'importGo':applyImport();break;
    case 'syncNow':closeSheet();pull();break;
    case 'restore':{const b=backupOf();if(!b)break;state=b;if(!state.ehpad)state.ehpad={};save();closeSheet();toast('Version précédente remise ✓');break}
    case 'syncOff':sync=null;saveSync();pulled=false;setSync('local');openData();break;
    // les clés ne sont effacées que si le mot de passe peut les rendre (ligne cle dans l'appli)
    case 'logout':try{localStorage.removeItem('zephir-profil');if(P.cle)localStorage.removeItem('zephir-cles-'+profil)}catch(e){}location.reload();break;
    case 'fab':if(tab==='urg')openUrgAdd();else openEditor(defaultSlot());break;
    case 'open':openDetails(a.dataset.type,a.dataset.k,a.dataset.id);break;
    case 'shift':openShift(a.dataset.k);break;
    case 'setShift':{const k=a.dataset.k,code=a.dataset.code;if(code)state.shifts[k]=code;else if(defOf(k))state.shifts[k]='';else delete state.shifts[k];save();closeSheet();break}
    case 'toggleImp':{if(!c)break;const r=refOf(c.type,c.k,c.id,true);if(!r)break;r.imp=!r.imp;save();openDetails(c.type,c.k,c.id);break}
    case 'ckTask':{if(!c)break;const r=refOf(c.type,c.k,c.id,true);const t=r&&(r.tasks||[]).find(x=>x.id===a.dataset.tid);if(t){t.done=!t.done;save();openDetails(c.type,c.k,c.id)}break}
    case 'delTask':{if(!c)break;const r=refOf(c.type,c.k,c.id,true);if(r){r.tasks=(r.tasks||[]).filter(x=>x.id!==a.dataset.tid);save();openDetails(c.type,c.k,c.id)}break}
    case 'edit':if(c&&c.id)openEditor({id:c.id});break;
    case 'delBlock':{
      if(!a.classList.contains('armed')){a.classList.add('armed');a.textContent='Confirmer ?';setTimeout(()=>{if(a.isConnected){a.classList.remove('armed');a.textContent='Supprimer'}},3000);break}
      state.blocks=state.blocks.filter(b=>b.id!==c.id);for(const g in parts)parts[g].blocks=parts[g].blocks.filter(b=>b.id!==c.id);save();closeSheet();break}
    case 'ckUrg':{const u=state.urgent.find(x=>x.id===a.dataset.id);if(u){u.done=!u.done;u.doneAt=Date.now();save()}break}
    case 'delUrg':state.urgent=state.urgent.filter(x=>x.id!==a.dataset.id);save();break;
    case 'clearUrg':state.urgent=state.urgent.filter(x=>!x.done);save();break;
  }
});

document.addEventListener('change',e=>{
  if(e.target.id==='impFile'&&e.target.files[0]){readImport(e.target.files[0]);return}
  if(e.target.name==='cat'&&sheetCtx&&sheetCtx.kind==='editor'){
    const v=e.target.value,tag=$('#edTag');tag.className='tag t-'+v;
    const ti=$('#sheet input[name=title]');if(ti)ti.placeholder=PH[v]||'';
    if(v==='love')groupeP().forEach(id=>{const x=$(`#sheet input[name=qui][value="${id}"]`);if(x)x.checked=true}); // plage en couple : partagée par défaut
  }
});

document.addEventListener('submit',e=>{
  e.preventDefault();
  const f=e.target,c=sheetCtx;
  switch(f.dataset.form){
    case 'addTask':{
      const txt=f.t.value.trim();if(!txt||!c)return;
      const r=refOf(c.type,c.k,c.id,true);if(!r)return;
      (r.tasks=r.tasks||[]).push({id:uid(),text:txt,done:false});save();openDetails(c.type,c.k,c.id,true);break;
    }
    case 'saveBlock':{
      const fd=new FormData(f);
      const start=fd.get('start'),end=fd.get('end');
      if(!start||!end){$('#edErr').textContent='Indique une heure de début et de fin.';return}
      if(endMin(end)<=t2m(start)){$('#edErr').textContent="L'heure de fin doit être après l'heure de début.";return}
      const old=c&&c.id&&allBlocks().find(b=>b.id===c.id);
      const data={cat:fd.get('cat')||(old&&old.cat)||'other',qui:[ME,...fd.getAll('qui')].sort(),title:String(fd.get('title')||'').trim(),date:fd.get('date'),start,end,imp:!!fd.get('imp')};
      let id=c&&c.id;
      if(id){Object.assign(old||{},data)}
      else{id=uid();state.blocks.push({id,...data,tasks:[]})}
      const wk=mondayOf(parse(data.date));if(key(wk)!==key(curMon))curMon=wk;
      save();openDetails('block',data.date,id);break;
    }
    case 'syncOn':{const t=f.t.value.trim();if(t)connect(t);break}
    case 'login':login(f.nom.value,f.t&&f.t.value.trim());break;
    case 'mkPw':{
      if(f.a.value!==f.b.value){$('#pwErr').textContent='Les deux mots de passe ne sont pas pareils.';return}
      $('#pwErr').textContent='';
      if(P.cle&&!cles)return; // ne pas fabriquer d'autres clés : celles de la ligne existante seraient perdues
      (async()=>{
        $('#pwErr').textContent='Chiffrement…';
        const neuf=!cles;if(neuf){cles=await newCles();saveCles()} // clés gardées si on change juste de mot de passe
        const cle=cles.pub+'.'+await lock({t:sync.token,x:cles.priv,d:cles.d},f.a.value);
        $('#pwErr').textContent='';
        const o=$('#pwOut');o.value=cle;o.hidden=false;o.select();
        navigator.clipboard&&navigator.clipboard.writeText(cle).then(()=>toast('Ligne copiée ✓'),()=>{});
        if(neuf){pulled=false;pull(true)}
      })();
      break;
    }
    case 'setHours':{
      const s=f.s.value,en=f.e.value;
      if(!s||!en||endMin(en)<=t2m(s)){$('#hrsErr').textContent="L'heure de fin doit être après l'heure de début.";return}
      state.shifts[c.k]=s+'-'+en;save();closeSheet();break;
    }
    case 'addUrg':{
      const txt=f.t.value.trim();if(!txt)return;
      state.urgent.push({id:uid(),text:txt,done:false,at:Date.now()});save();closeSheet();break;
    }
    case 'addUrgInline':{
      const txt=f.t.value.trim();if(!txt)return;
      f.t.value='';
      state.urgent.push({id:uid(),text:txt,done:false,at:Date.now()});save();
      const i=$('#pUrg input[name=t]');if(i)i.focus();break;
    }
  }
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeSheet();
  if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|SELECT|TEXTAREA/.test((e.target.tagName||''))&&!sheetCtx&&fsOK)toggleFS();
});

function sizeTop(){document.documentElement.style.setProperty('--toph',$('#top').offsetHeight+'px')}
let rzT=null;
window.addEventListener('resize',()=>{sizeTop();clearTimeout(rzT);rzT=setTimeout(()=>{fitHeight();if(isDesk()&&tab==='urg')setTab('plan')},60)});

/* ---------- start ---------- */
fsIcon();tickClock();
renderAll();sizeTop();
requestAnimationFrame(fitHeight);
document.fonts&&document.fonts.ready&&document.fonts.ready.then(fitHeight);
setTimeout(()=>$('#splash').classList.add('out'),2200);
setInterval(tickClock,1000);
setInterval(()=>{if(!sheetCtx){renderPlan();renderNow()}},60000);
setSync('local');
// page de connexion sous l'écran de lancement : visible quand il s'efface, retirée si déjà connecté (et son #syncErr avec)
if(profil){$('#login').remove();pull()}
else $('#login .logo').innerHTML=$('#splash .logo').innerHTML; // mot de passe toujours demandé, même si l'appareil connaît déjà le jeton
})();

/* ---------- mode hors connexion (PWA) ---------- */
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
