/* Pendly application logic. Extracted from index.html for maintainability. */

const SUPABASE_URL='https://prtdkebrtgwbbwvhdfea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_uJcwLGRq5MW-XTdeU111AA_nDoxcD1G';
let sb=null;
let supabaseReady=false;
if(window.supabase && typeof window.supabase.createClient==='function'){
  sb=window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
  });
  supabaseReady=true;}

const key='pendly-v04';
let data=JSON.parse(localStorage.getItem(key)||'{"train":0,"car":0,"events":{},"fuelPrices":{},"fgAnnual":0,"fgKmCost":0}');
data.fuelPrices=data.fuelPrices||{};
let currentUser=null;
let cloudDataReady=false;
let cloudLoadInProgress=false;
let cloudBootPromise=null;
let cloudLoadedUserId=null;
let authMode='login';
let saveTimer=null;
let statsPeriod='week';
const CO2_TRAIN_KG_PER_KM=0.030;
const CO2_CAR_DEFAULT_KG_PER_KM=0.192;

const $=id=>document.getElementById(id);
const eur=n=>Number(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});

function setAuthMessage(msg){$('authMsg').textContent=msg||'';}
function quickCalc(){
  const dist=Math.max(0,+$('quickDistance').value||0);
  const carKm=Math.max(0,+$('quickCarKm').value||0);
  const ticket=Math.max(0,+$('quickTicket').value||0);
  const days=Math.max(1,+$('quickDays').value||1);
  const perDay=dist*2*carKm;
  const net=Math.max(0,perDay-ticket/days);
  $('quickResult').textContent=eur(net);
  $('quickResultText').textContent='Netto-Ersparnis pro Zugtag · bei 1 Zugtag/Woche etwa '+eur(net*4.345)+' / Monat';
}

function setAuthMode(mode){
  authMode=mode;
  const recovery=mode==='recovery';
  $('loginTab').classList.toggle('active',mode==='login');
  $('signupTab').classList.toggle('active',mode==='signup');
  $('loginTab').style.display=recovery?'none':'block';
  $('signupTab').style.display=recovery?'none':'block';
  $('authSubmit').textContent=recovery?'Neues Passwort speichern':(mode==='login'?'Anmelden':'Konto erstellen');
  $('authPassword').autocomplete=recovery?'new-password':(mode==='login'?'current-password':'new-password');
  $('authPassword').placeholder=recovery?'Neues Passwort (mindestens 12 Zeichen)':'Mindestens 12 Zeichen';
  $('forgotPasswordBtn').style.display=mode==='login'?'block':'none';
  $('authEmail').readOnly=recovery;
  setAuthMessage(recovery?'Lege jetzt dein neues Passwort fest.':'');
}
async function requestPasswordReset(){
  if(!sb){setAuthMessage('Pendly konnte den Anmeldedienst nicht laden.');return;}
  const email=$('authEmail').value.trim();
  if(!email){setAuthMessage('Bitte zuerst deine E-Mail-Adresse eingeben.');return;}
  $('forgotPasswordBtn').disabled=true;
  setAuthMessage('E-Mail zum Zurücksetzen wird gesendet …');
  try{
    const redirectTo=window.location.origin+'/pendly/';
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
    if(error)throw error;
    setAuthMessage('Wenn ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Nachricht zum Zurücksetzen gesendet.');
  }catch(e){setAuthMessage(e.message||'Die E-Mail zum Zurücksetzen konnte nicht gesendet werden.');}
  finally{$('forgotPasswordBtn').disabled=false;}
}
async function submitAuth(){
  if(!supabaseReady || !sb){
    setAuthMessage('Pendly konnte den Anmeldedienst nicht laden. Bitte die Seite einmal neu laden.');
    return;
  }
  const email=$('authEmail').value.trim();
  const password=$('authPassword').value;
  if(!email || !password){setAuthMessage('Bitte E-Mail und Passwort eingeben.');return;}
  if(password.length<12){setAuthMessage('Das Passwort muss mindestens 12 Zeichen haben.');return;}
  $('authSubmit').disabled=true;
  setAuthMessage(authMode==='recovery'?'Passwort wird gespeichert …':(authMode==='login'?'Anmeldung …':'Konto wird erstellt …'));
  try{
    if(authMode==='recovery'){
      const {error}=await sb.auth.updateUser({password});
      if(error)throw error;
      setAuthMessage('Passwort erfolgreich geändert. Du kannst Pendly jetzt verwenden.');
      setAuthMode('login');
      $('authPassword').value='';
    }else if(authMode==='login'){
      const {error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      setAuthMessage('');
    }else{
      const redirectTo=window.location.origin+'/pendly/';
      const {data:result,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
      if(error) throw error;
      if(!result.session) setAuthMessage('Konto erstellt. Bitte bestätige deine E-Mail-Adresse und melde dich danach an.');
      else setAuthMessage('');
    }
  }catch(e){setAuthMessage(e.message||'Anmeldung fehlgeschlagen.');}
  finally{$('authSubmit').disabled=false;}
}
async function signOut(){
  await sb.auth.signOut();
  currentUser=null;
  $('auth').classList.remove('hidden');
  $('onboard').classList.add('hidden');
  $('accountBtn').textContent='Konto';
  closeAccount();
}
function updateAccountLabel(){
  if(!currentUser || !$('accountBtn')) return;
  const meta=currentUser.user_metadata||{};
  const name=[meta.first_name,meta.last_name].filter(Boolean).join(' ').trim();
  $('accountBtn').textContent=name||((currentUser.email||'Konto').split('@')[0]);
}
function accountMenu(){
  if(!currentUser)return;
  const meta=currentUser.user_metadata||{};
  $('profileFirstName').value=meta.first_name||'';
  $('profileLastName').value=meta.last_name||'';
  $('profileEmail').value=currentUser.email||'';
  $('profileNewPassword').value='';
  $('profileHint').textContent='';
  $('profileModal').classList.remove('hidden');
  $('profileModal').setAttribute('aria-hidden','false');
}
function closeAccount(){
  $('profileModal').classList.add('hidden');
  $('profileModal').setAttribute('aria-hidden','true');
}
function downloadTextFile(filename,text,mime){
  const blob=new Blob([text],{type:mime+';charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPendlyJSON(){
  if(!currentUser)return;
  const meta=currentUser.user_metadata||{};
  const payload={
    app:'Pendly',
    version:document.querySelector('.appVersion')?.textContent||'',
    exportedAt:new Date().toISOString(),
    account:{email:currentUser.email||'',firstName:meta.first_name||'',lastName:meta.last_name||''},
    settings:getSettings(),
    data:JSON.parse(JSON.stringify(data))
  };
  downloadTextFile('pendly-export-'+localISODate()+'.json',JSON.stringify(payload,null,2),'application/json');
  $('profileHint').textContent='JSON-Datensicherung wurde erstellt.';
}
function exportPendlyCSV(){
  if(!currentUser)return;
  const rows=[['Datum','Fahrt','Entfernung einfache Strecke (km)','Kraftstoffpreis (€/l)','Vermeidbare Autokosten (€)','Ticketanteil (€)','Netto-Ersparnis (€)','CO₂-Ersparnis (kg)']];
  Object.keys(data.events||{}).sort().forEach(day=>{
    const type=data.events[day];
    const eco=calculateTripEconomics(day);
    const fp=data.fuelPrices?.[day];
    const price=fp&&Number(fp.price)>0?Number(fp.price):'';
    rows.push([day,type||'',String(+$('distance').value||0).replace('.',','),price===''?'':Number(price).toFixed(3).replace('.',','),Number(eco.avoidable||0).toFixed(2).replace('.',','),Number(eco.ticket||0).toFixed(2).replace('.',','),Number(eco.net||0).toFixed(2).replace('.',','),Number(eco.co2||0).toFixed(3).replace('.',',')]);
  });
  const csv='\\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\\r\\n');
  downloadTextFile('pendly-fahrten-'+localISODate()+'.csv',csv,'text/csv');
  $('profileHint').textContent='CSV-Export wurde erstellt.';
}

async function saveProfile(){
  if(!currentUser||!sb)return;
  const first=$('profileFirstName').value.trim();
  const last=$('profileLastName').value.trim();
  $('profileHint').textContent='Profil wird gespeichert …';
  try{
    const {data:result,error}=await sb.auth.updateUser({data:{first_name:first,last_name:last,full_name:[first,last].filter(Boolean).join(' ')}});
    if(error)throw error;
    currentUser=result.user||currentUser;
    updateAccountLabel();
    $('profileHint').textContent='Profil gespeichert.';
  }catch(e){$('profileHint').textContent=e.message||'Profil konnte nicht gespeichert werden.';}
}
async function changePassword(){
  if(!currentUser||!sb)return;
  const currentPassword=$('profileCurrentPassword').value;
  const password=$('profileNewPassword').value;
  const repeat=$('profileNewPasswordRepeat').value;
  if(!currentPassword){$('profileHint').textContent='Bitte dein aktuelles Passwort eingeben.';return;}
  if(password.length<12){$('profileHint').textContent='Das neue Passwort muss mindestens 12 Zeichen haben.';return;}
  if(password!==repeat){$('profileHint').textContent='Die neuen Passwörter stimmen nicht überein.';return;}
  if(password===currentPassword){$('profileHint').textContent='Das neue Passwort sollte sich vom aktuellen unterscheiden.';return;}
  $('profileHint').textContent='Passwort wird geändert …';
  try{
    const {error:verifyError}=await sb.auth.signInWithPassword({email:currentUser.email,password:currentPassword});
    if(verifyError)throw new Error('Das aktuelle Passwort ist nicht korrekt.');
    const {error}=await sb.auth.updateUser({password});
    if(error)throw error;
    $('profileCurrentPassword').value='';
    $('profileNewPassword').value='';
    $('profileNewPasswordRepeat').value='';
    $('profileHint').textContent='Passwort erfolgreich geändert.';
  }catch(e){$('profileHint').textContent=e.message||'Passwort konnte nicht geändert werden.';}
}
function localDataKey(userId){return 'pendly-user-'+userId;}

async function loadUserData(){
  if(cloudLoadInProgress)return false;
  cloudDataReady=false;
  if(!currentUser || !supabaseReady || !sb)return false;
  cloudLoadInProgress=true;
  const userId=currentUser.id;
  const localKey=localDataKey(userId);
  const settingsKey='pendly-settings-'+userId;
  let hadCloudData=false;
  let localSettings=null;
  try{
    const cached=localStorage.getItem(localKey);
    if(cached){try{data={...data,...JSON.parse(cached)};}catch{}}
    const cachedSettings=localStorage.getItem(settingsKey);
    if(cachedSettings){try{localSettings=JSON.parse(cachedSettings);applySettings(localSettings);}catch{}}
    const {data:row,error}=await sb.from('user_data').select('data,settings').eq('user_id',userId).maybeSingle();
    if(error)throw error;
    if(!row)throw new Error('Für dieses Konto wurde kein Pendly-Profil gefunden.');
    if(row.data && typeof row.data==='object'){
      data={...data,...row.data};
      data.events=(row.data.events && typeof row.data.events==='object')?row.data.events:{};
      data.fuelPrices=(row.data.fuelPrices && typeof row.data.fuelPrices==='object')?row.data.fuelPrices:{};
      hadCloudData=true;
    }
    const cloudSettings=row.settings;
    const cloudHasProfile=cloudSettings && (Number(cloudSettings.carKm)>0 || Number(cloudSettings.avoidableKm)>0 || Number(cloudSettings.annualKm)>0);
    const localHasProfile=localSettings && (Number(localSettings.carKm)>0 || Number(localSettings.avoidableKm)>0 || Number(localSettings.annualKm)>0);
    if(cloudHasProfile){
      const merged={...(localSettings||{}),...(cloudSettings||{})};
      for(const id of ['distance','fuelKm','maintenanceKm','depreciationKm','avoidableKm','ticket','days','goal']){
        const lv=Number(localSettings?.[id]??0);
        const cv=Number(cloudSettings?.[id]??0);
        if(lv>0 && cv<=0)merged[id]=localSettings[id];
      }
      applySettings(merged);
      hadCloudData=true;
    }else if(localHasProfile)applySettings(localSettings);
    const {data:history,error:historyError}=await sb.from('commute_days').select('travel_date,mode,avoidable_cost_snapshot,ticket_cost_snapshot,net_saving_snapshot,co2_saving_snapshot').eq('user_id',userId);
    if(historyError){
      console.warn('Pendly-Historie konnte nicht geladen werden:',historyError);
      data.commuteSnapshots={};
    }else{
      data.commuteSnapshots={};
      (history||[]).forEach(row=>{data.commuteSnapshots[row.travel_date]={mode:row.mode,avoidable:Number(row.avoidable_cost_snapshot||0),ticket:Number(row.ticket_cost_snapshot||0),net:Number(row.net_saving_snapshot||0),co2:Number(row.co2_saving_snapshot||0)};});
    }
    syncTripCounters();
    repairCostBreakdown();
    localStorage.setItem(localKey,JSON.stringify(data));
    localStorage.setItem(settingsKey,JSON.stringify(getSettings()));
    cloudDataReady=true;
    return hadCloudData||!!localHasProfile;
  }catch(e){
    console.warn('Pendly-Ladefehler:',e);
    cloudDataReady=false;
    return false;
  }finally{cloudLoadInProgress=false;}
}


function getSettings(){
  return {
    carKm:+($('carKm')?.value||0), avoidableKm:+($('avoidableKm')?.value||0), annualKm:+($('annualKm')?.value||0),
    fuelKm:+($('fuelKm')?.value||0), fuelConsumption:+($('setFuelConsumption')?.value||0), fuelPrice:+($('setFuelFallbackPrice')?.value||$('setFuelPrice')?.value||0), fuelType:$('setFuelType')?.value||'e5', fuelPostcode:$('setFuelPostcode')?.value||'', fuelPriceUpdatedAt:data.fuelPriceUpdatedAt||null, maintenanceKm:+($('maintenanceKm')?.value||0), depreciationKm:+($('depreciationKm')?.value||0), carPurchasePrice:+($('carPurchasePrice')?.value||0), carAge:+($('carAge')?.value||0),
    insurance:+($('insurance')?.value||0), maintenance:+($('maintenance')?.value||0),
    tax:+($('tax')?.value||0), parking:+($('parking')?.value||0),
    ticket:+($('ticket')?.value||0), days:+($('days')?.value||0),
    distance:+($('distance')?.value||0), goal:+($('goal')?.value||0), co2CarKgKm:+($('co2CarKgKm')?.value||CO2_CAR_DEFAULT_KG_PER_KM)
  };
}
function applySettings(s){
  for(const [id,value] of Object.entries(s||{})) if($(id)&&value!==undefined) $(id).value=value;
  loadSettings();
}

function syncTripCounters(){
  // The event calendar is the source of truth. Older profiles can contain
  // correct events but stale train/car counters, which made the savings
  // breakdown show 0,00 € even though trips were recorded.
  let train=0, car=0;
  for(const type of Object.values(data.events||{})){
    if(type==='train') train++;
    else if(type==='car') car++;
  }
  data.train=train;
  data.car=car;
}

function estimateDepreciationPerKm(price,age){
  const value=Math.max(0,Number(price)||0);
  const years=Math.max(0,Number(age)||0);
  if(value<=0)return 0;
  // Näherungsmodell: Der Wertverlust ist in den ersten Jahren höher und
  // flacht mit zunehmendem Fahrzeugalter ab. Das ist bewusst keine
  // individuelle Marktwertbewertung, sondern eine transparente Schätzung.
  const points=[[0,1.35],[1,1.25],[3,1.10],[5,1.00],[10,0.70],[15,0.50]];
  let factor=points[points.length-1][1];
  for(let i=0;i<points.length-1;i++){
    const [a,f1]=points[i], [b,f2]=points[i+1];
    if(years<=b){
      const t=Math.max(0,Math.min(1,(years-a)/(b-a)));
      factor=f1+(f2-f1)*t;
      break;
    }
  }
  return (value*0.85/200000)*factor;
}

function repairCostBreakdown(){
  const annual=Math.max(1,+$('annualKm').value||0);
  const totalKm=Math.max(0,+$('carKm').value||0);
  const insurance=Math.max(0,+$('insurance').value||0);
  const tax=Math.max(0,+$('tax').value||0);
  const parking=Math.max(0,+$('parking').value||0);

  // Fixed costs do not become avoidable when a commuting day is replaced.
  const fixedKm=(insurance*12+tax+parking*12)/annual;

  let avoidable=Math.max(0,+$('avoidableKm').value||0);
  let fuel=Math.max(0,+$('fuelKm').value||0);
  let maintKm=Math.max(0,+$('maintenanceKm').value||0);
  let depr=Math.max(0,+$('depreciationKm').value||0);
  const purchasePrice=Math.max(0,+$('carPurchasePrice').value||0);
  const carAge=Math.max(0,+$('carAge').value||0);
  if(purchasePrice>0){
    depr=estimateDepreciationPerKm(purchasePrice,carAge);
  }

  // Recover the fuel component for older profiles when the user has entered
  // consumption and fuel price in the settings.
  const consumption=Math.max(0,+$('setFuelConsumption')?.value||0);
  const fuelPrice=Math.max(0,+$('setFuelPrice')?.value||0);
  if(fuel<=0 && consumption>0 && fuelPrice>0){
    fuel=consumption*fuelPrice/100;
  }

  // Repair old profiles where only the total car cost was stored.
  if(avoidable<=0 && totalKm>0){
    avoidable=Math.max(0,totalKm-fixedKm);
  }

  // If the exact component split is missing, keep the recovered fuel amount
  // and distribute only the remaining avoidable amount.
  if(avoidable>0 && maintKm+depr<=0){
    const remaining=Math.max(0,avoidable-fuel);
    maintKm=Math.min(remaining,Math.max(0,+$('maintenance').value||0)*12/annual);
    depr=Math.max(0,remaining-maintKm);
  }

  $('avoidableKm').value=avoidable.toFixed(4);
  $('fuelKm').value=fuel.toFixed(4);
  $('maintenanceKm').value=maintKm.toFixed(4);
  $('depreciationKm').value=depr.toFixed(4);

  if($('setFuelKmDisplay')){
    const today=localISODate();
    const selectedType=$('setFuelType')?.value||'e5';
    const liveFp=data.fuelPrices?.[today];
    const livePrice=liveFp&&liveFp.type===selectedType?Number(liveFp.price):fuelPrice;
    const displayFuel=(consumption>0&&Number.isFinite(livePrice)&&livePrice>0)
      ? consumption*livePrice/100
      : fuel;
    $('setFuelKmDisplay').textContent=displayFuel.toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})+' €/km';
  }
}
async function saveCloud(){
  // Do not write anything until the current user's cloud row has been read
  // successfully. This prevents an early calc() from overwriting real data
  // with the zero-valued HTML defaults.
  if(!currentUser || !supabaseReady || !sb || !cloudDataReady)return false;
  const settings=getSettings();
  const payload={user_id:currentUser.id,data,settings,updated_at:new Date().toISOString()};
  const {error}=await sb.from('user_data').upsert(payload,{onConflict:'user_id'});
  if(error){console.warn('Pendly-Speicherfehler:',error);return false;}
  localStorage.setItem(localDataKey(currentUser.id),JSON.stringify(data));
  localStorage.setItem('pendly-settings-'+currentUser.id,JSON.stringify(settings));
  localStorage.setItem('pendly-onboard-'+currentUser.id,'1');
  return true;
}
function scheduleCloudSave(){
  if(!currentUser)return;
  clearTimeout(saveTimer); saveTimer=setTimeout(()=>saveCloud(),500);
}

function updateFuelUI(){
  const type=$('oType').value;
  const elec=type==='Elektro';
  $('fuelField').style.display=elec?'none':'block';
  $('oConsumption').value=elec?'18':'6.5';
  $('oConsumptionLabel').textContent=elec?'Verbrauch (kWh / 100 km)':'Verbrauch (Liter / 100 km)';
}

function quickStartOnboarding(){
  $('oInsurance').value=90;
  $('oMaintenance').value=70;
  $('oTax').value=180;
  $('oParking').value=0;
  $('oTicketMode').value='employer_full';
  $('oTicketTotal').value=63;
  $('oTicketOwn').value=0;
  updateTicketUI();
  showResult();
  $('q3').style.display='none';
}

function nextQ(){
  $('q1').style.display='none';
  $('q2').style.display='block';
  updateFuelUI();
}

function nextQ2(){
  $('q2').style.display='none';
  $('q3').style.display='block';
}

function nextQ3(){
  $('q3').style.display='none';
  $('qticket').style.display='block';
  $('q4').style.display='none';
}
function updateTicketUI(){
  const mode=$('oTicketMode').value;
  $('ticketTotalField').style.display=mode==='employer_full'?'block':'none';
  $('ticketOwnField').style.display=mode==='employer_part'||mode==='self'?'block':'none';
}
function typeToCo2(type){
  if(type==='Elektro') return 0.050;
  if(type==='Diesel') return 0.205;
  if(type==='Hybrid') return 0.140;
  return CO2_CAR_DEFAULT_KG_PER_KM;
}
function showResult(){
  $('qticket').style.display='none';
  const type=$('oType').value;
  const annual=+$('oAnnual').value||12500;
  const price=+$('oPrice').value||30000;
  const age=+$('oAge').value||4;
  const cons=+$('oConsumption').value||0;
  const fuel=+$('oFuel').value||0;

  // Separate the cost model into transparent components.
  const energy=type==='Elektro' ? cons*0.38/100 : cons*fuel/100;
  const insurance=(+$('oInsurance').value||0)*12/annual;
  const maint=(+$('oMaintenance').value||0)*12/annual;
  const tax=(+$('oTax').value||0)/annual;
  const parking=(+$('oParking').value||0)*12/annual;
  const depreciation=estimateDepreciationPerKm(price,age);

  const totalOwnershipKmCost=energy+insurance+maint+tax+parking+depreciation;

  // Only kilometer-dependent costs count as "avoidable" savings.
  // Insurance, tax and parking continue even when the car is parked.
  const avoidableKmCost=energy+maint+depreciation;

  window.onboardingKmCost=totalOwnershipKmCost;
  window.onboardingAvoidableKmCost=avoidableKmCost;
  window.onboardingFuelKm=energy;
  window.onboardingMaintenanceKm=maint;
  window.onboardingDepreciationKm=depreciation;

  $('oFuelPart').textContent=eur(energy);
  $('oFixedPart').textContent=eur(insurance+tax+parking+maint+depreciation);
  $('oResult').textContent=eur(totalOwnershipKmCost);

  $('q3').style.display='none';
  $('q4').style.display='block';
}

async function finishOnboarding(){
  try{
    const cost=Number(window.onboardingKmCost||0);
    if(!Number.isFinite(cost) || cost<=0){
      alert('Die Autokosten konnten noch nicht berechnet werden.');
      return;
    }
    $('carKm').value=cost.toFixed(3);
    $('carPurchasePrice').value=(+$('oPrice').value||0).toFixed(2);
    $('carAge').value=(+$('oAge').value||0).toFixed(1);
    if($('avoidableKm')) $('avoidableKm').value=Number(window.onboardingAvoidableKmCost||0).toFixed(3);
    if($('annualKm')) $('annualKm').value=+$('oAnnual').value||12500;
    if($('fuelKm')) $('fuelKm').value=Number(window.onboardingFuelKm||0).toFixed(4);
    if($('maintenanceKm')) $('maintenanceKm').value=Number(window.onboardingMaintenanceKm||0).toFixed(4);
    if($('depreciationKm')) $('depreciationKm').value=Number(window.onboardingDepreciationKm||0).toFixed(4);
    if($('co2CarKgKm')) $('co2CarKgKm').value=typeToCo2($('oType').value).toFixed(3);
    if($('days')) $('days').value=20;
    if($('distance')) $('distance').value=0;
    if($('insurance')) $('insurance').value=(+$('oInsurance').value||0).toFixed(2);
    if($('maintenance')) $('maintenance').value=(+$('oMaintenance').value||0).toFixed(2);
    if($('tax')) $('tax').value=(+$('oTax').value||0).toFixed(2);
    if($('parking')) $('parking').value=(+$('oParking').value||0).toFixed(2);
    const mode=$('oTicketMode') ? $('oTicketMode').value : 'employer_full';
    const totalTicket=$('oTicketTotal') ? (+$('oTicketTotal').value||0) : 0;
    const ownField=$('oTicketOwn') ? (+$('oTicketOwn').value||0) : 0;
    const ownTicket=mode==='employer_full' ? 0 : (ownField||totalTicket);
    if($('ticket')) $('ticket').value=ownTicket.toFixed(2);

    // Save the onboarding result to the user's cloud profile before closing it.
    localStorage.setItem('pendly-onboard-'+(currentUser?.id||'guest'),'1');
    localStorage.setItem(currentUser?localDataKey(currentUser.id):key,JSON.stringify(data));
    localStorage.setItem('pendly-settings-'+(currentUser?.id||'guest'),JSON.stringify(getSettings()));
    if(currentUser){
      cloudDataReady=true;
      await saveCloud();
    }

    // Close the onboarding overlay and explicitly show the main app.
    $('onboard').style.display='none';
    $('onboard').classList.add('hidden');
    const app=document.querySelector('.app');
    if(app) app.style.display='block';

    calc();
    window.scrollTo({top:0,behavior:'smooth'});
  }catch(err){
    alert('Beim Speichern ist ein Fehler aufgetreten. Bitte versuche es noch einmal.');
    console.error(err);
  }
}

function normalizeText(v){
  return String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function parseFinancialGuru(rows){
  let total=0, hits=0;
  const terms=['tanken','tankstelle','kfz-steuer','kfz steuer','parken','werkstatt','service','kfz-versicherung','kfz versicherung','leasing','automobilklub','automobilclub','reifen'];
  for(const row of rows){
    const text=normalizeText(Object.values(row).join(' '));
    if(!terms.some(t=>text.includes(t))) continue;
    let amount=0;
    for(const [k,v] of Object.entries(row)){
      const key=normalizeText(k);
      if(/betrag|amount|umsatz|summe|wert/.test(key)){
        const n=typeof v==='number'?v:parseFloat(String(v).replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''));
        if(Number.isFinite(n)){amount=Math.abs(n);break;}
      }
    }
    if(amount>0){total+=amount;hits++;}
  }
  return {total,hits};
}
async function importFinancialGuru(file){
  $('fgStatus').textContent='Datei wird analysiert …';
  try{
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array'});
    let rows=[];
    wb.SheetNames.forEach(name=>{
      rows=rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:''}));
    });
    const result=parseFinancialGuru(rows);
    if(!result.hits){
      $('fgStatus').textContent='Ich konnte keine passenden Auto-Buchungen erkennen. Prüfe bitte, ob du den Finanzguru-Excel-Export hochgeladen hast.';
      return;
    }
    const annual=result.total;
    const km=+$('annualKm').value||+$('oAnnual').value||12500;
    data.fgAnnual=annual;
    data.fgKmCost=annual/km;
    data.fgImportedAt=new Date().toISOString();
    $('fgAnnual').textContent=eur(annual);
    $('fgKmCost').textContent=eur(data.fgKmCost);
    $('fgResult').style.display='block';
    $('fgStatus').textContent=`${result.hits} passende Buchungen erkannt. Originaldatei bleibt lokal.`;
    localStorage.setItem(currentUser?localDataKey(currentUser.id):key,JSON.stringify(data));
    scheduleCloudSave();
  }catch(e){
    $('fgStatus').textContent='Die Datei konnte nicht gelesen werden. Bitte einen XLSX- oder CSV-Export aus Finanzguru verwenden.';
  }
}
function applyFinancialGuru(){
  if(data.fgKmCost>0){
    $('carKm').value=data.fgKmCost.toFixed(3);
    calc();
    $('fgStatus').textContent='Finanzguru-Daten werden jetzt als Grundlage verwendet.';
  }
}
function getPeriodRange(period){
  const now=new Date(); now.setHours(0,0,0,0);
  if(period==='week'){
    const day=(now.getDay()+6)%7;
    const start=new Date(now); start.setDate(now.getDate()-day);
    const end=new Date(start); end.setDate(start.getDate()+7);
    return {start,end,label:'Diese Woche'};
  }
  if(period==='month'){
    const start=new Date(now.getFullYear(),now.getMonth(),1);
    const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    return {start,end,label:'Diesen Monat'};
  }
  const start=new Date(now.getFullYear(),0,1);
  const end=new Date(now.getFullYear()+1,0,1);
  return {start,end,label:'Dieses Jahr'};
}
function historicalDayEconomics(day){
  const snap=data.commuteSnapshots?.[day];
  if(snap && snap.mode==='train'){
    return {avoidable:Number(snap.avoidable||0),ticket:Number(snap.ticket||0),net:Number(snap.net||0),co2:Number(snap.co2||0)};
  }
  return calculateTripEconomics(day);
}

function getPeriodStats(period){
  const {start,end,label}=getPeriodRange(period);
  let train=0,car=0,home=0,avoided=0;
  for(const [iso,type] of Object.entries(data.events||{})){
    const d=new Date(iso+'T12:00:00');
    if(d>=start && d<end){
      if(type==='train'){
        train++;
        avoided+=historicalDayEconomics(iso).avoidable;
      }else if(type==='car'){
        car++;
      }else if(type==='home'){
        home++;
      }
    }
  }

  // Das Monatsticket ist ein fixer Monatsaufwand und wird deshalb einmal
  // pro Monatsauswertung berücksichtigt. Wochen- und Jahreswerte werden
  // entsprechend auf ihren Zeitraum hochgerechnet.
  const monthlyTicket=Math.max(0,+$('ticket').value||0);
  const ticketCost=period==='year'?monthlyTicket*12:(period==='month'?monthlyTicket:monthlyTicket/4.345);
  const net=Math.max(0,avoided-ticketCost);
  let co2Saved=0;
  for(const [iso,type] of Object.entries(data.events||{})){
    const d=new Date(iso+'T12:00:00');
    if(type==='train' && d>=start && d<end) co2Saved+=historicalDayEconomics(iso).co2;
  }
  return {start,end,label,train,car,home,avoided,ticketCost,net,co2Saved,total:train+car+home};
}

function formatKg(v){
  return `${Number(v||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})} kg`;
}
function updateProgress(){
  const st=getPeriodStats('month');
  $('progressSaved').textContent=eur(st.net);
  $('progressCo2').textContent=formatKg(st.co2Saved);
  $('progressTrain').textContent=st.train;
  $('progressTrips').textContent=st.total;
  const pct=st.total?Math.round(st.train/st.total*100):0;
  $('progressSubtitle').textContent=`${pct}% deiner erfassten Arbeitstage mit dem Zug`;
  $('progressBadge').textContent=st.train>=10?'🏆 Starkes Pendly-Monat':'🌱 Pendly-Fortschritt';
}
function setStatsPeriod(period){
  statsPeriod=period;
  document.querySelectorAll('.periods button').forEach(b=>b.classList.remove('active'));
  const btn=$('period'+period.charAt(0).toUpperCase()+period.slice(1));
  if(btn) btn.classList.add('active');
  updateStats();
}
function updateMonthlyReview(){
  const st=getPeriodStats('month');
  const rate=st.total?Math.round(st.train/st.total*100):0;
  $('reviewMoney').textContent=eur(st.net);
  $('reviewCo2').textContent=formatKg(st.co2Saved);
  $('reviewTrips').textContent=st.train;
  $('reviewRate').textContent=rate+' %';
  $('reviewTitle').textContent=new Date().toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  $('reviewText').textContent=st.train
    ? `Du hast diesen Monat ${st.train} Autofahrt${st.train===1?'':'en'} vermieden und damit deine Pendly-Bilanz verbessert.`
    : 'Noch keine Zugfahrt erfasst. Jede vermiedene Autofahrt zählt.';
  const milestone=Math.max(10,Math.ceil(Math.max(1,st.train)/10)*10);
  $('milestoneValue').textContent=`${Math.min(milestone,st.train)} / ${milestone}`;
  $('milestoneFill').style.width=Math.min(100,st.train/milestone*100)+'%';
  $('milestoneTitle').textContent=st.train>=100?'🏆 100 Autofahrten vermieden':st.train>=50?'🏅 50 Autofahrten vermieden':st.train>=25?'🌟 25 Autofahrten vermieden':st.train>=10?'🌱 10 Autofahrten vermieden':'🌱 Erster Schritt';
  $('milestoneText').textContent=st.train>=10?'Du bist auf einem starken Weg.':'Noch '+Math.max(0,10-st.train)+' bis zum ersten Meilenstein.';
}
async function syncCommuteDaySnapshot(day){
  if(!currentUser||!supabaseReady||!sb||!cloudDataReady)return false;
  const type=data.events?.[day];
  try{
    if(!type){
      const {error}=await sb.from('commute_days').delete().eq('user_id',currentUser.id).eq('travel_date',day);
      if(error)throw error;
      return true;
    }
    const eco=type==='train'?calculateTripEconomics(day):{avoidable:0,ticket:0,net:0,co2:0};
    const fp=data.fuelPrices?.[day];
    const payload={
      user_id:currentUser.id,
      travel_date:day,
      mode:type,
      distance_km:Math.max(0,+$('distance').value||0),
      fuel_price:fp&&Number(fp.price)>0?Number(fp.price):null,
      fuel_type:fp?.type||null,
      avoidable_cost_snapshot:Number(eco.avoidable||0).toFixed(2),
      ticket_cost_snapshot:Number(eco.ticket||0).toFixed(2),
      net_saving_snapshot:Number(eco.net||0).toFixed(2),
      co2_saving_snapshot:Number(eco.co2||0).toFixed(3),
      snapshot_source:fp?'pendly-day-price':'pendly-current-settings',
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from('commute_days').upsert(payload,{onConflict:'user_id,travel_date'});
    if(error)throw error;
    return true;
  }catch(e){console.warn('Pendly-Historien-Snapshot:',e);return false;}
}

function calculateTripEconomics(day){
  const type=data.events?.[day];
  if(type!=='train') return {fuel:0,maintenance:0,depreciation:0,avoidable:0,ticket:0,net:0,co2:0};
  const dist=Math.max(0,+$('distance').value||0);
  const fuelType=$('setFuelType')?.value||'e5';
  const fallbackFuelPrice=Math.max(0,+$('setFuelFallbackPrice')?.value||+$('setFuelPrice').value||0);
  const fuelConsumption=Math.max(0,+$('setFuelConsumption').value||0);
  const fp=data.fuelPrices?.[day];
  const price=fp&&fp.type===fuelType?Number(fp.price):fallbackFuelPrice;
  const fuel=price>0&&fuelConsumption>0?dist*2*fuelConsumption*price/100:dist*2*(+$('fuelKm').value||0);
  const maintenance=dist*2*(+$('maintenanceKm').value||0);
  const depreciation=dist*2*(+$('depreciationKm').value||0);
  const avoidable=fuel+maintenance+depreciation;
  const monthlyTicket=Math.max(0,+$('ticket').value||0);
  const workdays=Math.max(1,+$('days').value||1);
  const ticket=monthlyTicket/workdays;
  const carCo2=+$('co2CarKgKm').value||CO2_CAR_DEFAULT_KG_PER_KM;
  const co2=Math.max(0,(carCo2-CO2_TRAIN_KG_PER_KM)*dist*2);
  return {fuel,maintenance,depreciation,avoidable,ticket,net:Math.max(0,avoidable-ticket),co2};
}

function calc(){
  // Defensive normalization: incomplete/legacy cloud data must never stop the UI.
  if(!data || typeof data!=='object') data={train:0,car:0,events:{},fuelPrices:{},fgAnnual:0,fgKmCost:0};
  if(!data.events || typeof data.events!=='object') data.events={};
  if(!data.fuelPrices || typeof data.fuelPrices!=='object') data.fuelPrices={};
  if(!Number.isFinite(Number(data.train))) data.train=0;
  if(!Number.isFinite(Number(data.car))) data.car=0;
  // Always rebuild the counters from the dated events before calculating
  // savings. This prevents legacy/stale counters from forcing the breakdown
  // to 0,00 €.
  syncTripCounters();
  const fullKm=+$('carKm').value||0;
  let avoidableKm=+$('avoidableKm').value||fullKm;
  if($('carKmDisplay')) $('carKmDisplay').textContent=fullKm.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €/km';
  const ticket=+$('ticket').value||0;
  const days=+$('days').value||1;
  const dist=+$('distance').value||0;
  if($('perDay') && dist<=0) $('perDay').textContent='Bitte Strecke in Einstellungen eintragen';

  const insuranceMonthly=(+$('insurance').value||0);
  const maintenanceMonthly=(+$('maintenance').value||0);
  const taxMonthly=(+$('tax').value||0)/12;
  const parkingMonthly=(+$('parking').value||0);
  const fixedPerDay=(insuranceMonthly+taxMonthly+parkingMonthly)/days;

  repairCostBreakdown();
  avoidableKm=+$('avoidableKm').value||0;
  const avoidableTrip=avoidableKm*dist*2;
  const fullTrip=fullKm*dist*2+fixedPerDay;
  const train=ticket/days;

  // Component values are persisted with the onboarding profile. For older
  // profiles, derive missing components from the total avoidable cost so the
  // breakdown never silently falls back to 0,00 €.
  const fuelKm=+$('fuelKm').value||0;
  const maintenanceKm=+$('maintenanceKm').value||0;
  const depreciationKm=+$('depreciationKm').value||Math.max(0,avoidableKm-fuelKm-maintenanceKm);
  const factor=dist*2*data.train;
  const fuelType=$('setFuelType')?.value||'e5';
  let breakFuel=0;
  let breakMaintenance=0;
  let breakDepreciation=0;
  let fuelPriceDays=0;
  for(const day of Object.keys(data.events||{})){
    const trip=calculateTripEconomics(day);
    breakFuel+=trip.fuel;
    breakMaintenance+=trip.maintenance;
    breakDepreciation+=trip.depreciation;
    if(trip.fuel>0) fuelPriceDays++;
  }
  const dynamicAvoidable=breakFuel+breakMaintenance+breakDepreciation;
  const dynamicSaved=(fuelPriceDays>0||breakFuel>0)?dynamicAvoidable:avoidableTrip*data.train;
  const saved=dynamicSaved;
  const net=Math.max(0,saved-ticket);
  const savedWithoutDepreciation=Math.max(0,breakFuel+breakMaintenance-ticket);

  $('autoCost').textContent=eur(fullTrip);
  $('trainCost').textContent=eur(train);
  const todayTrip=data.events?.[localISODate()] === 'train' ? calculateTripEconomics(localISODate()) : null;
  $('perDay').textContent=todayTrip ? eur(todayTrip.avoidable) : '—';
  $('netMonth').textContent=eur(net);
  $('saving').textContent=eur(savedWithoutDepreciation);
  if($('savingWithDepreciation')) $('savingWithDepreciation').textContent=eur(net);
  const savingGoal=Math.max(0,+$('goal').value||2000);
  const savingPct=savingGoal>0?Math.min(100,Math.max(0,net/savingGoal*100)):0;
  if($('savingGoalPct')) $('savingGoalPct').textContent=Math.round(savingPct)+' %';
  if($('savingGoalFill')) $('savingGoalFill').style.width=savingPct+'%';
  if($('savingMessage')){
    $('savingMessage').textContent=savedWithoutDepreciation<=0?'Starte mit deiner ersten Zugfahrt und sieh, was du sparen kannst.':savingPct>=100?'Dein Sparziel ist erreicht. Stark gemacht! 🎉':savedWithoutDepreciation>=100?'Du bist schon auf einem guten Weg. Jede Zugfahrt zählt.':'Jede Zugfahrt macht deine Pendelbilanz ein Stück besser.';
  }
  $('trainDays').textContent=data.train;
  $('carDays').textContent=data.car;

  // Die heutigen Fahrbuttons zeigen nur dann eine Auswahlfarbe, wenn für heute tatsächlich eine Fahrt gespeichert ist.
  const todayType=data.events?.[localISODate()]||'';
  document.querySelector('.action.train')?.classList.toggle('selected',todayType==='train');
  document.querySelector('.action.car')?.classList.toggle('selected',todayType==='car');

  if($('breakFuel')) $('breakFuel').textContent=eur(breakFuel);
  if($('breakMaintenance')) $('breakMaintenance').textContent=eur(breakMaintenance);
  if($('breakDepreciation')) $('breakDepreciation').textContent=eur(breakDepreciation);
  if($('breakFixed')) $('breakFixed').textContent='0,00 €';
  if($('breakAvoidable')) $('breakAvoidable').textContent=eur(Math.max(saved,dynamicSaved));
  if($('breakTicket')) $('breakTicket').textContent=eur(ticket);
  if($('breakNet')) $('breakNet').textContent=eur(Math.max(0,Math.max(saved,dynamicSaved)-ticket));

  const goal=+$('goal').value||2000;
  const pct=Math.min(100,net/goal*100);
  $('goalText').textContent=`${eur(net)} / ${eur(goal)}`;
  $('goalPct').textContent=`${Math.round(pct)} % erreicht`;
  $('goalFill').style.width=pct+'%';
  try{updateProgress();}catch(e){console.warn('Pendly-Fortschrittsanzeige:',e);}
  try{updateMonthlyReview();}catch(e){console.warn('Pendly-Monatsreview:',e);}

  try{renderCalendar();}catch(e){console.warn('Pendly-Kalender:',e);}
  localStorage.setItem(currentUser?localDataKey(currentUser.id):key,JSON.stringify(data));
  scheduleCloudSave();
  updateScenario();
  updateBreakEven();
  updateEstimateBasis();
  updateAnnualReport();
}

function localISODate(date=new Date()){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

let calendarDate=new Date();
calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1);

function changeCalendarMonth(delta){
  calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+Number(delta),1);
  renderCalendar();
}

function bindCalendarMonthButtons(){
  const prev=$('calendarPrev');
  const next=$('calendarNext');
  if(prev && !prev.dataset.bound){ prev.dataset.bound='1'; prev.addEventListener('click',()=>changeCalendarMonth(-1)); }
  if(next && !next.dataset.bound){ next.dataset.bound='1'; next.addEventListener('click',()=>changeCalendarMonth(1)); }
}

function goToCurrentMonth(){
  const now=new Date();
  calendarDate=new Date(now.getFullYear(),now.getMonth(),1);
  renderCalendar();
}

async function travel(type){
  const day=localISODate();
  const old=data.events[day];
  if(old===type)return;
  if(old==='train')data.train=Math.max(0,data.train-1);
  if(old==='car')data.car=Math.max(0,data.car-1);
  data.events[day]=type;
  if(type==='train')data.train++;
  else if(type==='car')data.car++;
  if(type==='train' && !data.fuelPrices?.[day]) await ensureFuelPriceForToday();
  calc();
  await syncCommuteDaySnapshot(day);

  let amount=type==='train'
    ? calculateTripEconomics(day).net
    : 0;
  $('toast').textContent=type==='train'?`+ ${eur(amount)} vermiedene Autokosten`:'Autofahrt gespeichert';
  $('toast').classList.add('show');
  setTimeout(()=>$('toast').classList.remove('show'),1400);
}

function bindCalendarInteractions(){
  const el=$('calendar');
  if(!el || el.dataset.bound==='1')return;
  el.dataset.bound='1';
  el.addEventListener('click',event=>{
    const cell=event.target.closest('.calday[data-iso]');
    if(cell) openEditor(cell.dataset.iso);
  });
}

function renderCalendar(){
  const el=$('calendar');
  if(!el)return;
  const year=calendarDate.getFullYear(), month=calendarDate.getMonth();
  const monthName=calendarDate.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  if($('calendarTitle')) $('calendarTitle').textContent=monthName.charAt(0).toUpperCase()+monthName.slice(1);
  el.innerHTML=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="calhead">${x}</div>`).join('');
  bindCalendarInteractions();

  const first=new Date(year,month,1);
  const last=new Date(year,month+1,0);
  // JavaScript uses Sunday=0, while Pendly displays Monday first.
  const offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++) el.innerHTML+='<div class="calday empty"></div>';

  const today=localISODate();
  bindCalendarMonthButtons();
  for(let d=1;d<=last.getDate();d++){
    const date=new Date(year,month,d);
    const dow=date.getDay();
    const iso=localISODate(date);
    const type=data.events[iso]||'';
    const isWeekend=dow===0||dow===6;
    const isToday=iso===today;
    const icon=type==='train'?'🚆':type==='car'?'🚗':type==='home'?'🏠':type==='off'?'🌴':isWeekend?'':'·';
    const classes=['calday',type,isWeekend?'home':'',isToday?'today':''].filter(Boolean).join(' ');
    el.innerHTML+=`<div class="${classes}" data-iso="${iso}"><b>${d}</b>${icon}</div>`;
  }
}

let editingDay=null;
function openEditor(iso){
  editingDay=iso;
  const d=new Date(iso+'T12:00:00');
  $('editDateTitle').textContent=d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
  $('dayEditor').style.display='flex';
}
function closeEditor(){editingDay=null;$('dayEditor').style.display='none'}
async function setDay(type){
  if(!editingDay)return;
  const day=editingDay;
  const old=data.events[day];
  if(old===type){closeEditor();return}
  if(old==='train')data.train=Math.max(0,data.train-1);
  if(old==='car')data.car=Math.max(0,data.car-1);
  data.events[day]=type;
  if(type==='train')data.train++; else data.car++;
  closeEditor();
  calc();
  const selectedFuelType=String($('setFuelType').value||'e5').toLowerCase();
  const existingFuelPrice=data.fuelPrices?.[day];
  if(type==='train' && (!existingFuelPrice || existingFuelPrice.type!==selectedFuelType) && day<=localISODate()){
    $('fuelSettingsHint').textContent='Kraftstoffpreis für '+day+' wird automatisch abgerufen …';
    await fetchFuelPrice(false,day);
    calc();
  }
  await syncCommuteDaySnapshot(day);
}
async function clearDay(){
  if(!editingDay)return;
  const day=editingDay;
  const old=data.events[day];
  if(old==='train')data.train=Math.max(0,data.train-1);
  if(old==='car')data.car=Math.max(0,data.car-1);
  delete data.events[day];
  closeEditor();calc();
  await syncCommuteDaySnapshot(day);
}


function showTab(tab,btn){
  document.querySelectorAll('.tabPanel').forEach(x=>x.style.display='none');
  $('overviewTab') && ($('overviewTab').style.display=tab==='overview'?'block':'none');
  $('statsTab').style.display=tab==='stats'?'block':'none';
  $('settingsTab').style.display=tab==='settings'?'block':'none';
  document.querySelectorAll('#bottomNav button').forEach(x=>x.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(tab==='stats') updateStats();
  if(tab==='settings') loadSettings();
  window.scrollTo({top:0,behavior:'smooth'});
}
function updateEstimateBasis(){
  const el=$('estimateBasis');
  if(!el)return;
  const trainDays=Object.keys(data.events||{}).filter(d=>data.events[d]==='train'&&data.fuelPrices?.[d]&&Number(data.fuelPrices[d].price)>0).length;
  const hasGuru=Number(data.fgKmCost||0)>0;
  const hasFuel=Number($('fuelKm').value||0)>0;
  if(hasGuru) el.textContent='Persönliche Buchungen';
  else if(trainDays>0) el.textContent='Tagespreise + Fahrzeugdaten';
  else if(hasFuel) el.textContent='Fahrzeugdaten + Ersatzpreis';
  else el.textContent='Modellannahmen';
}

function updateBreakEven(){
  const out=$('breakEvenDays'),text=$('breakEvenText');
  if(!out||!text)return;
  const monthlyTicket=Math.max(0,+$('ticket').value||0);
  const dist=Math.max(0,+$('distance').value||0);
  const variable=Math.max(0,(+$('fuelKm').value||0)+(+$('maintenanceKm').value||0)+(+$('depreciationKm').value||0));
  const avoidedPerTrainDay=dist*2*variable;
  if(monthlyTicket<=0){
    out.textContent='0 Zugtage';
    text.textContent='Du trägst aktuell keinen eigenen monatlichen Ticketanteil.';
    return;
  }
  if(avoidedPerTrainDay<=0){
    out.textContent='Noch nicht berechenbar';
    text.textContent='Hinterlege Entfernung und kilometerabhängige Autokosten, damit Pendly den Break-even berechnen kann.';
    return;
  }
  const days=monthlyTicket/avoidedPerTrainDay;
  out.textContent=days<1?'unter 1 Zugtag':days.toLocaleString('de-DE',{maximumFractionDigits:1})+' Zugtage';
  text.textContent='Rechnerisch ist dein eigener Monatsbeitrag nach etwa '+days.toLocaleString('de-DE',{maximumFractionDigits:1})+' Zugtagen durch vermiedene Autokosten ausgeglichen. Das ist eine Monatsbetrachtung und keine Aussage über die langfristige Rentabilität des Tickets.';
}

function getSelectedPatternDays(){
  return [...document.querySelectorAll('#patternDays button.selected')].map(b=>Number(b.dataset.day)).filter(n=>n>=1&&n<=5);
}
function applyCommutePattern(){
  const days=getSelectedPatternDays();
  const type=$('patternType')?.value||'train';
  if(!days.length){$('patternResult').textContent='Bitte mindestens einen Wochentag auswählen.';return;}
  const today=new Date();
  today.setHours(12,0,0,0);
  let added=0;
  for(let i=0;i<42;i++){
    const d=new Date(today);
    d.setDate(today.getDate()+i);
    const weekday=d.getDay();
    const iso=localISODate(d);
    if(days.includes(weekday) && !data.events[iso]){
      data.events[iso]=type;
      added++;
    }
  }
  data.commutePattern={type,days,updatedAt:new Date().toISOString(),horizonDays:42};
  calc();
  $('patternResult').textContent=added
    ? added+' freie Tage wurden eingetragen. Bereits vorhandene Einträge blieben unverändert.'
    : 'Keine freien Tage im gewählten Zeitraum gefunden. Vorhandene Einträge blieben unverändert.';
  saveCloud();
}

function updateAnnualReport(){
  const year=new Date().getFullYear();
  let train=0,car=0,home=0,avoided=0,co2=0;
  Object.keys(data.events||{}).forEach(iso=>{
    if(!iso.startsWith(String(year)+'-'))return;
    const type=data.events[iso];
    if(type==='train'){train++;const eco=historicalDayEconomics(iso);avoided+=eco.avoidable;co2+=eco.co2;}
    else if(type==='car')car++;
    else if(type==='home')home++;
  });
  const ticket=Math.max(0,+$('ticket').value||0)*12;
  const net=Math.max(0,avoided-ticket);
  const workdays=train+car+home;
  $('annualReportTitle').textContent='Jahresrückblick '+year;
  $('annualReportNet').textContent=eur(net);
  $('annualTrain').textContent=train;
  $('annualCar').textContent=car;
  $('annualHome').textContent=home;
  $('annualAvoided').textContent=eur(avoided);
  $('annualCo2').textContent=formatKg(co2);
  $('annualRate').textContent=(workdays?Math.round(train/workdays*100):0)+' %';
}
async function shareAnnualReport(){
  const text=annualReportText();
  try{
    if(navigator.share){
      await navigator.share({title:'Mein Pendly-Jahresbericht',text});
      return;
    }
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      $('toast').textContent='Jahresbericht in die Zwischenablage kopiert.';
      $('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1600);
      return;
    }
    downloadTextFile('pendly-jahresbericht-'+new Date().getFullYear()+'.txt',text,'text/plain');
  }catch(e){
    if(e?.name!=='AbortError'){
      downloadTextFile('pendly-jahresbericht-'+new Date().getFullYear()+'.txt',text,'text/plain');
    }
  }
}

function annualReportText(){
  const year=new Date().getFullYear();
  return 'Pendly-Jahresbericht '+year+'\n\n'+
    'Netto-Ersparnis: '+$('annualReportNet').textContent+'\n'+
    'Zugfahrten: '+$('annualTrain').textContent+'\n'+
    'Autofahrten: '+$('annualCar').textContent+'\n'+
    'Homeoffice-Tage: '+$('annualHome').textContent+'\n'+
    'Autokosten vermieden: '+$('annualAvoided').textContent+'\n'+
    'CO₂ geschätzt eingespart: '+$('annualCo2').textContent+'\n'+
    'Zuganteil der erfassten Arbeitstage: '+$('annualRate').textContent+'\n\n'+
    'Pendly · persönliche Schätzung auf Basis deiner hinterlegten Daten.';
}

function updateScenario(){
  const slider=$('scenarioDays');
  if(!slider)return;
  const extra=Math.max(0,Math.min(5,+slider.value||0));
  const dist=Math.max(0,+$('distance').value||0);
  const variable=Math.max(0,(+$('fuelKm').value||0)+(+$('maintenanceKm').value||0)+(+$('depreciationKm').value||0));
  const avoidablePerTrainDay=dist*2*variable;
  const ticketPerDay=Math.max(0,+$('ticket').value||0)/Math.max(1,+$('days').value||1);
  const netPerExtraDay=Math.max(0,avoidablePerTrainDay-ticketPerDay);
  const monthly=netPerExtraDay*extra*4.345;
  const yearly=netPerExtraDay*extra*52.14;
  $('scenarioDaysLabel').textContent=extra===1?'1 Zugtag mehr / Woche':extra+' Zugtage mehr / Woche';
  $('scenarioMonth').textContent=eur(monthly);
  $('scenarioYear').textContent=eur(yearly);
  $('scenarioHint').textContent=extra===0
    ? 'Wähle zusätzliche Zugtage, um das Potenzial deiner aktuellen Pendelstrecke zu sehen.'
    : 'Bei '+eur(netPerExtraDay)+' Netto-Ersparnis pro zusätzlichem Zugtag ergibt das etwa '+eur(monthly)+' pro Monat.';
}

function updateStats(){
  const st=getPeriodStats(statsPeriod);
  $('sTrain').textContent=st.train;
  $('sCar').textContent=st.car;
  if($('sHome')) $('sHome').textContent=st.home;
  $('sAvoided').textContent=eur(st.avoided);
  $('sCo2').textContent=formatKg(st.co2Saved);
  $('periodNet').textContent=eur(st.net);
  $('periodLabel').textContent=st.label;
  const range=st.start.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+' – '+new Date(st.end-1).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
  $('periodCompare').textContent=`${range} · ${st.train} Zugfahrten`;
  $('statsMonth').textContent=new Date().toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  updateMonthlyReview();
}
function loadSettings(){
  if($('setFuelConsumption')) $('setFuelConsumption').value=$('setFuelConsumption').value || '';
  if($('setFuelPrice')) $('setFuelPrice').value=$('setFuelPrice').value || '';
  if($('setFuelFallbackPrice')) $('setFuelFallbackPrice').value=$('setFuelFallbackPrice').value || $('setFuelPrice').value || '';
  if($('setFuelType')) $('setFuelType').value=$('setFuelType').value || 'e5';
  if($('setFuelPostcode')) $('setFuelPostcode').value=$('setFuelPostcode').value || '';
  $('setDistance').value=$('distance').value;
  $('setDays').value=$('days').value;
  $('setAnnualKm').value=$('annualKm').value;
  $('setCarKmDisplay').textContent=(+$('carKm').value||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €/km';
  $('setAvoidableKmDisplay').textContent=(+$('avoidableKm').value||+$('carKm').value||0).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €/km';
  $('setInsurance').value=$('insurance').value;
  $('setMaintenance').value=$('maintenance').value;
  $('setTax').value=$('tax').value;
  $('setParking').value=$('parking').value;
  $('setTicket').value=$('ticket').value;
  $('setGoal').value=$('goal').value;
  if($('setFuelConsumption') && $('setFuelPrice')){
    const fc=+$('setFuelConsumption').value||0;
    const fp=+$('setFuelPrice').value||0;
    $('fuelSettingsHint').textContent=(fc>0 && fp>0)
      ? 'Kraftstoffkosten sind hinterlegt. Der Ersatzpreis wird verwendet, wenn kein Tagespreis verfügbar ist.'
      : 'Bitte Verbrauch und einen Ersatzpreis ergänzen. So bleibt die Ersparnis auch bei einem API-Ausfall sichtbar.';
  }
  $('setCarCo2Display').textContent=Math.round((+$('co2CarKgKm').value||CO2_CAR_DEFAULT_KG_PER_KM)*1000)+' g/km';
  $('setTrainCo2Display').textContent=Math.round(CO2_TRAIN_KG_PER_KM*1000)+' g/km';
}
async function saveFuelSettings(){
  const consumption=Math.max(0,+$('setFuelConsumption').value||0);
  const price=Math.max(0,+$('setFuelFallbackPrice').value||0);
  if(consumption<=0){$('fuelSettingsHint').textContent='Bitte deinen Verbrauch eingeben.';return;}
  $('setFuelPrice').value=price>0?price:'';
  const fuel=price>0?consumption*price/100:(+$('fuelKm').value||0);
  if(fuel>0)$('fuelKm').value=fuel.toFixed(4);
  repairCostBreakdown();
  loadSettings();
  const ok=await saveCloud();
  $('fuelSettingsHint').textContent=ok?'Kraftstoff-Einstellungen gespeichert.':'Lokal gespeichert – Cloud-Speicherung fehlgeschlagen.';
  calc();
}

async function fetchFuelPrice(userAction=false, targetDay=null){
  const postcode=String($('setFuelPostcode').value||'').trim();
  const type=String($('setFuelType').value||'e5').toLowerCase();
  const day=targetDay||localISODate();

  if(!/^\d{5}$/.test(postcode)){
    $('fuelSettingsHint').textContent='Bitte zuerst eine gültige 5-stellige Pendel-PLZ eingeben.';
    return false;
  }

  const fuelMap={e5:'E5',e10:'E10',diesel:'Diesel'};
  const fuel=fuelMap[type]||'E5';
  if(userAction) $('fuelSettingsHint').textContent='Kraftstoffpreise der Zugtage werden aktualisiert …';
  try{
    if(!sb) throw new Error('Supabase ist nicht verbunden.');
    const {data:sessionData,error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    const accessToken=sessionData?.session?.access_token;
    if(!accessToken) throw new Error('Keine gültige Supabase-Sitzung vorhanden. Bitte neu anmelden.');
    const r=await fetch(SUPABASE_URL+'/functions/v1/dynamic-worker',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_PUBLISHABLE_KEY,
        'Authorization':'Bearer '+accessToken
      },
      body:JSON.stringify({postcode,type:fuel,date:day})
    });
    const result=await r.json().catch(()=>({}));
    if(!r.ok||!result.ok){
      throw new Error(result.message||'Kraftstoffpreis konnte nicht geladen werden.');
    }

    const price=Number(result.average??result.median??result.price);
    if(!Number.isFinite(price)||price<=0) throw new Error('Kein gültiger Kraftstoffpreis erhalten.');

    data.fuelPrices=data.fuelPrices||{};
    const today=localISODate();
    data.fuelPrices[day]={
      price,
      type,
      postcode,
      source:result.source||'Kraftstoffdaten',
      updatedAt:new Date().toISOString(),
      historical:day!==today
    };

    // Keep the manual fallback price. It is only used when a daily price is unavailable.

    if(day===today){
      $('setFuelLivePrice').textContent=price.toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})+' €/l';
      $('fuelPriceSource').textContent=(result.source||'Kraftstoffdaten')+' · '+day;
      const consumption=Math.max(0,+$('setFuelConsumption').value||0);
      if(consumption>0) $('fuelKm').value=(consumption*price/100).toFixed(4);
    }

    repairCostBreakdown();
    calc();
    loadSettings();
    await saveCloud();
    if(userAction) $('fuelSettingsHint').textContent='Kraftstoffpreise wurden neu abgerufen.';
    return true;
  }catch(e){
    $('fuelSettingsHint').textContent=e.message||'Kraftstoffpreis konnte nicht geladen werden.';
    return false;
  }
}

function openFuelPriceDetails(){
  const list=$('fuelPriceList');
  if(!list)return;
  const today=localISODate();
  const fuelType=$('setFuelType')?.value||'e5';
  const fallback=Math.max(0,+$('setFuelFallbackPrice')?.value||+$('setFuelPrice')?.value||0);
  const fuelMap={e5:'Super E5',e10:'Super E10',diesel:'Diesel'};
  const days=Object.keys(data.events||{}).filter(d=>data.events[d]==='train').sort();
  if(!days.length){
    list.innerHTML='<div class="sub">Noch keine Zugtage im Kalender eingetragen.</div>';
  }else{
    list.innerHTML=days.map(day=>{
      const fp=data.fuelPrices?.[day];
      const valid=fp&&fp.type===fuelType&&Number(fp.price)>0;
      const price=valid?Number(fp.price):fallback;
      const date=new Date(day+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
      let source=valid?(fp.source||'Kraftstoffdaten'):'Ersatzpreis';
      let cls=valid?'':'fuelPriceFallback';
      if(valid && String(source).toLowerCase().includes('näherungs')) cls='fuelPriceApprox';
      const note=valid
        ? (String(source).toLowerCase().includes('näherungs')?'Näherungswert aus benachbarten Tageswerten':'verwendeter Tagespreis')
        : 'kein Tagespreis gespeichert';
      return '<div class="fuelPriceItem"><div><b>'+date+'</b><span class="fuelPriceSource '+cls+'">'+fuelMap[fuelType]+' · '+note+'<br>'+source+'</span></div><div class="fuelPriceValue">'+(price>0?price.toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})+' €/l':'–')+'</div></div>';
    }).join('');
  }
  $('fuelPriceModal').classList.remove('hidden');
  $('fuelPriceModal').setAttribute('aria-hidden','false');
}
function closeFuelPriceDetails(){
  $('fuelPriceModal').classList.add('hidden');
  $('fuelPriceModal').setAttribute('aria-hidden','true');
}
async function refreshFuelPricesForTrainDays(){
  const today=localISODate();
  const allDays=Object.keys(data.events||{}).filter(d=>data.events[d]==='train').sort();
  const days=allDays.filter(d=>d<=today);
  const future=allDays.length-days.length;
  if(!allDays.length){
    $('fuelSettingsHint').textContent='Noch keine Zugtage im Kalender eingetragen.';
    return;
  }
  if(!days.length){
    $('fuelSettingsHint').textContent='Für zukünftige Zugtage wird der Preis automatisch am jeweiligen Tag abgerufen.';
    return;
  }
  $('fuelSettingsHint').textContent='Preise für '+days.length+' vergangene/heutige Zugtage werden abgerufen …';
  let ok=0, errors=[];
  for(const day of days){
    const success=await fetchFuelPrice(false,day);
    if(success) ok++;
    else{
      const msg=$('fuelSettingsHint').textContent||'Unbekannter Fehler';
      errors.push(day+': '+msg);
    }
  }
  calc();
  if(ok===days.length){
    $('fuelSettingsHint').textContent='Alle '+ok+' Zugtage wurden neu abgerufen und berechnet.'+(future?' '+future+' zukünftige Zugtage werden automatisch am jeweiligen Tag aktualisiert.':'');
  }else{
    const detail=errors[0]||'Unbekannter Fehler';
    $('fuelSettingsHint').textContent=ok+' von '+days.length+' Zugtagen konnten aktualisiert werden. '+detail;
  }
}

async function ensureFuelPriceForToday(){
  const day=localISODate();
  const selectedType=String($('setFuelType').value||'e5').toLowerCase();
  const existing=data.fuelPrices?.[day];
  if(/^\d{5}$/.test(String($('setFuelPostcode').value||'')) &&
     (!existing || existing.type!==selectedType)){
    await fetchFuelPrice(false,day);
  }
}
async function saveSettings(){
  if($('setFuelFallbackPrice') && $('setFuelPrice')) $('setFuelPrice').value=$('setFuelFallbackPrice').value;
  $('distance').value=$('setDistance').value;
  $('days').value=$('setDays').value;
  $('annualKm').value=$('setAnnualKm').value;
  $('insurance').value=$('setInsurance').value;
  $('maintenance').value=$('setMaintenance').value;
  $('tax').value=$('setTax').value;
  $('parking').value=$('setParking').value;
  $('ticket').value=$('setTicket').value;
  $('goal').value=$('setGoal').value;
  calc();
  const ok=await saveCloud();
  showTab('overview',document.querySelector('#bottomNav button'));
  $('toast').textContent=ok?'Änderungen gespeichert':'Lokal gespeichert – Cloud-Speicherung fehlgeschlagen';
  $('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1400);
}
function resetData(){
  if(confirm('Alle Fahrten wirklich löschen?')){
    data={train:0,car:0,events:{},fuelPrices:{},fgAnnual:0,fgKmCost:0};
    localStorage.setItem(currentUser?localDataKey(currentUser.id):key,JSON.stringify(data));
    calc(); updateStats();
  }
}
document.addEventListener('DOMContentLoaded',async()=>{
  $('accountBtn').addEventListener('click',accountMenu);
  // Defensive loading: a malformed local setting must never stop the auth flow.
  try{
    const savedFuelSettings=JSON.parse(localStorage.getItem('pendly-settings-'+(currentUser?.id||'guest'))||'null');
    if(savedFuelSettings){
      if($('setFuelConsumption')) $('setFuelConsumption').value=savedFuelSettings.fuelConsumption||'';
      if($('setFuelPrice')) $('setFuelPrice').value=savedFuelSettings.fuelPrice||'';
      if($('setFuelFallbackPrice')) $('setFuelFallbackPrice').value=savedFuelSettings.fuelPrice||'';
      if($('setFuelType')) $('setFuelType').value=savedFuelSettings.fuelType||'e5';
      if($('setFuelPostcode')) $('setFuelPostcode').value=savedFuelSettings.fuelPostcode||'';
    }
  }catch(_e){
    try{localStorage.removeItem('pendly-settings-'+(currentUser?.id||'guest'));}catch(__e){}
  }
  $('oType').addEventListener('change',updateFuelUI);
  $('fgFile').addEventListener('change',e=>{if(e.target.files[0])importFinancialGuru(e.target.files[0]);});
  $('oTicketMode').addEventListener('change',updateTicketUI);
  updateTicketUI();
  if($('setFuelFallbackPrice')) $('setFuelFallbackPrice').addEventListener('input',()=>{
    if($('setFuelPrice')) $('setFuelPrice').value=$('setFuelFallbackPrice').value;
    repairCostBreakdown();
    calc();
  });
  ['carKm','avoidableKm','fuelKm','maintenanceKm','depreciationKm','ticket','days','distance','insurance','maintenance','tax','parking','goal','annualKm','co2CarKgKm'].forEach(id=>{if($(id)) $(id).addEventListener('input',calc);});
  $('month').textContent=new Date().toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  if($('scenarioDays')) $('scenarioDays').addEventListener('input',updateScenario);
  document.querySelectorAll('#patternDays button').forEach(btn=>btn.addEventListener('click',()=>{btn.classList.toggle('selected');}));
  updateScenario();

  if(!supabaseReady || !sb){
    $('auth').classList.remove('hidden');
    $('onboard').classList.add('hidden');
    setAuthMessage('Anmeldedienst konnte nicht geladen werden. Bitte Safari neu laden.');
    calc();
    return;
  }

  function showCloudBoot(message,failed=false){
    const box=$('cloudBoot');
    if(!box)return;
    $('cloudBootTitle').textContent=failed?'Deine Daten konnten nicht geladen werden.':'Deine Daten werden geladen …';
    $('cloudBootText').textContent=message||'Pendly lädt dein persönliches Profil aus der Cloud.';
    $('cloudBootRetry').style.display=failed?'inline-block':'none';
    box.classList.remove('hidden');
  }
  function hideCloudBoot(){const box=$('cloudBoot');if(box)box.classList.add('hidden')}
  async function bootAuthenticatedUser(user){
    if(!user)return false;
    const userId=user.id;
    if(cloudLoadedUserId===userId&&cloudDataReady){hideCloudBoot();return true}
    if(cloudBootPromise)return cloudBootPromise;
    cloudBootPromise=(async()=>{
      showCloudBoot();
      $('auth').classList.add('hidden');
      $('onboard').classList.add('hidden');
      let ok=false;
      for(let attempt=0;attempt<3&&currentUser?.id===userId&&!ok;attempt++){
        ok=await loadUserData();
        if(!ok&&attempt<2)await new Promise(resolve=>setTimeout(resolve,400));
      }
      if(currentUser?.id!==userId)return false;
      if(!ok||!cloudDataReady){
        showCloudBoot('Die Verbindung zur Cloud funktioniert, aber dein Profil konnte gerade nicht vollständig gelesen werden. Deine gespeicherten Daten wurden dabei nicht verändert.',true);
        return false;
      }
      cloudLoadedUserId=userId;
      updateAccountLabel();
      $('auth').classList.add('hidden');
      $('onboard').classList.add('hidden');
      calc();
      hideCloudBoot();
      return true;
    })().catch(e=>{
      console.warn('Pendly-Laden:',e);
      cloudDataReady=false;
      showCloudBoot('Beim Laden deines Pendly-Profils ist ein Fehler aufgetreten. Deine gespeicherten Daten wurden dabei nicht verändert.',true);
      return false;
    }).finally(()=>{cloudBootPromise=null});
    return cloudBootPromise;
  }
  try{
    sb.auth.onAuthStateChange((event,session)=>{
      const nextUser=session?.user||null;
      if(event==='PASSWORD_RECOVERY'){
        currentUser=nextUser;
        $('auth').classList.remove('hidden');
        $('onboard').classList.add('hidden');
        setAuthMode('recovery');
        return;
      }
      currentUser=nextUser;
      if(event==='SIGNED_OUT'||!nextUser){
        cloudDataReady=false;cloudLoadedUserId=null;cloudBootPromise=null;
        $('auth').classList.remove('hidden');$('onboard').classList.add('hidden');hideCloudBoot();return;
      }
      if(event==='TOKEN_REFRESHED'&&cloudLoadedUserId===nextUser.id&&cloudDataReady){updateAccountLabel();return}
      setTimeout(()=>bootAuthenticatedUser(nextUser),0);
    });
  }catch(e){currentUser=null;showCloudBoot('Der Anmeldedienst konnte nicht gestartet werden. Bitte lade Pendly erneut.',true)}
  try{
    const {data:sessionData,error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    if(sessionData?.session?.user){
      currentUser=sessionData.session.user;
      setTimeout(()=>bootAuthenticatedUser(sessionData.session.user),0);
    }else{
      hideCloudBoot();$('auth').classList.remove('hidden');$('onboard').classList.add('hidden');
    }
  }catch(e){
    console.warn('Pendly-Sitzung:',e);
    showCloudBoot('Die Sitzung konnte nicht geladen werden. Bitte lade Pendly erneut.',true);
  }


  if(Math.abs((+$('carKm').value||0)-0.35)<0.0001 && !data.fgKmCost){
    const annual=+$('annualKm').value||12500;
    const fixed=(+$('insurance').value||0)*12+(+$('maintenance').value||0)*12;
    if(fixed>0) $('carKm').value=(fixed/annual).toFixed(3);
  }
});

// Render the calendar immediately after the page DOM is available. This keeps the calendar visible even while auth/cloud data is loading.
try{
  bindCalendarMonthButtons();
  renderCalendar();
}catch(e){console.warn('Pendly-Kalender-Initialisierung:',e);}

window.setAuthMode=setAuthMode;
window.requestPasswordReset=requestPasswordReset;
window.submitAuth=submitAuth;
window.nextQ=nextQ;
window.nextQ2=nextQ2;
window.nextQ3=nextQ3;
window.showResult=showResult;
window.finishOnboarding=finishOnboarding;
window.travel=travel;
window.openEditor=openEditor;
window.setDay=setDay;
window.clearDay=clearDay;
window.closeEditor=closeEditor;
window.showTab=showTab;
window.saveSettings=saveSettings;
window.resetData=resetData;
window.accountMenu=accountMenu;
window.exportPendlyJSON=exportPendlyJSON;
window.exportPendlyCSV=exportPendlyCSV;
window.shareAnnualReport=shareAnnualReport;
window.closeAccount=closeAccount;
window.saveProfile=saveProfile;
window.changePassword=changePassword;

window.showTab=showTab;window.updateStats=updateStats;window.loadSettings=loadSettings;
window.saveSettings=saveSettings;window.resetData=resetData;

