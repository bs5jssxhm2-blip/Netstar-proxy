const NETSTAR_BASE = "https://fleetai-api.netstaraus.com.au";
const NETSTAR_API_KEY = "aROAW0rN00qS3Ar5iOnog";
const COMPANY = "Netstar Demo";
const LOCATION = "Netstar Demo";
const DATE_FROM = "07-04-2026 00:00:01";
const DATE_TO = "13-04-2026 23:59:59";
const GITHUB_RAW = "https://raw.githubusercontent.com/bs5jssxhm2-blip/Netstar-proxy/main";

function cors(){return{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,x-api-key,Authorization","Access-Control-Max-Age":"86400"};}
function json(data,status){status=status||200;return new Response(JSON.stringify(data),{status:status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});}
function err(msg,status){return json({error:msg},status||400);}
function pad(n){return String(n).padStart(2,"0");}
function toNetstar(s,endOfDay){if(!s)return null;var d=new Date(s);if(isNaN(d))return null;if(endOfDay)d.setUTCHours(23,59,59);return pad(d.getUTCDate())+"-"+pad(d.getUTCMonth()+1)+"-"+d.getUTCFullYear()+" "+pad(d.getUTCHours())+":"+pad(d.getUTCMinutes())+":"+pad(d.getUTCSeconds());}
function safe(v){var n=parseFloat(v);return isNaN(n)||n<0?0:n;}
function calcRisk(r){var braking=safe(r.harsh_breaking||0),accel=safe(r.harsh_acceleration||0),cornering=safe(r.harsh_cornering||0);var speeding=safe(r.over_speed||0),night=safe(r.night_drive||0),idling=safe(r.idling||0);var avgSpd=safe(r.avg_speed||0),maxSpd=safe(r.max_speed||0),km=safe(r.total_running_km||0);var per100=km>0?100/km:1;var eventScore=(braking*3.0*per100)+(accel*2.5*per100)+(cornering*2.0*per100)+(speeding*3.5*per100)+(night*1.5*per100)+(idling*0.5*per100);var speedPenalty=0;if(avgSpd>80)speedPenalty+=15;else if(avgSpd>60)speedPenalty+=5;if(maxSpd>130)speedPenalty+=20;else if(maxSpd>110)speedPenalty+=10;else if(maxSpd>100)speedPenalty+=5;var raw=Math.min(eventScore*10+speedPenalty,100);return{risk_score:Math.round(Math.min(Math.max(raw,0),100)*10)/10,features:{harsh_breaking:braking,harsh_acceleration:accel,harsh_cornering:cornering,over_speed:speeding,night_drive:night,idling:idling}};}
function lossCost(sc,km){km=km||15000;return Math.round(1200*(Math.exp(sc/35)-0.9)*Math.sqrt(km/15000));}
function riskBand(sc){if(sc<20)return"Excellent";if(sc<40)return"Good";if(sc<60)return"Moderate";if(sc<80)return"High";return"Critical";}
function mapVehicles(raw){var vehicles=[];try{var data=raw.data||raw,branches=data.branch||[];for(var i=0;i<branches.length;i++){var branch=branches[i],bv=branch.vehicles||[];for(var j=0;j<bv.length;j++){var v=bv[j];vehicles.push({imei:v.imei_no||"",id:v.imei_no||"",registration:v.vehicle_no||v.device_name||"",driver_name:v.driver_name||"Unknown",make:v.device_model||"",company:data.company_name||COMPANY,location:branch.branch_name||""});}}}catch(e){vehicles=[];}return{vehicles:vehicles,total:vehicles.length};}
async function netstarPOST(path,body){var res=await fetch(NETSTAR_BASE+path,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":NETSTAR_API_KEY,"Accept":"application/json"},body:JSON.stringify(body)});var text=await res.text();if(!res.ok)throw new Error("Netstar "+res.status+": "+text.slice(0,300));try{return JSON.parse(text);}catch(e){throw new Error("Non-JSON: "+text.slice(0,300));}}
async function getDriverPerf(start,end){var q=new URLSearchParams({company_names:COMPANY,location_names:LOCATION,start_date_time:start,end_date_time:end});var res=await fetch(NETSTAR_BASE+"/external/drivers/driver-performance-summary?"+q.toString(),{method:"GET",headers:{"x-api-key":NETSTAR_API_KEY,"Accept":"application/json"}});var text=await res.text();if(!res.ok)throw new Error("Netstar "+res.status+": "+text.slice(0,300));var data=JSON.parse(text);if(data.status==="fail")throw new Error(data.message||"Driver performance request failed");return Array.isArray(data)?data:(data.data||data.result||[]);}
async function getVehicleList(){var raw=await netstarPOST("/external/company-vehicles",{});return mapVehicles(raw).vehicles;}
async function handleVehicles(){var raw=await netstarPOST("/external/company-vehicles",{});return json(mapVehicles(raw));}
async function handleDriverScore(url){
  var imei=url.searchParams.get("imei")||null;
  var annual_km=parseInt(url.searchParams.get("annual_km")||"15000");
  var start=toNetstar(url.searchParams.get("start_date"))||DATE_FROM;
  var end=toNetstar(url.searchParams.get("end_date"),true)||DATE_TO;
  if(!imei)throw new Error("imei parameter required");
  var vlist=await getVehicleList();
  var vinfo=null;
  for(var vi=0;vi<vlist.length;vi++){if(vlist[vi].imei===imei){vinfo=vlist[vi];break;}}
  var list=await getDriverPerf(start,end);
  if(!list.length)throw new Error("No driver data for this period.");
  var r=list[0];
  if(vinfo&&vinfo.driver_name&&vinfo.driver_name!=="Unknown"){for(var i=0;i<list.length;i++){if((list[i].driver_name||"").toLowerCase()===(vinfo.driver_name||"").toLowerCase()){r=list[i];break;}}}
  var scored=calcRisk(r);
  return json({imei:imei,driver_name:r.driver_name||r.driver||(vinfo&&vinfo.driver_name)||"Unknown",registration:(vinfo&&vinfo.registration)||r.object||r.vehicle_no||imei,company:r.company_name||r.branch_name||COMPANY,period_from:start,period_to:end,features:scored.features,risk_score:scored.risk_score,risk_band:riskBand(scored.risk_score),predicted_loss_cost:lossCost(scored.risk_score,annual_km),total_distance_km:safe(r.total_running_km||0),running_time:r.total_running_duration||"N/A",avg_speed:safe(r.avg_speed||0),max_speed:safe(r.max_speed||0),netstar_driver_score:0,raw_record:r});
}
async function handleFleetScores(url){
  var annual_km=parseInt(url.searchParams.get("annual_km")||"15000");
  var start=toNetstar(url.searchParams.get("start_date"))||DATE_FROM;
  var end=toNetstar(url.searchParams.get("end_date"),true)||DATE_TO;
  var vlist=await getVehicleList();
var list=await getDriverPerf(start,end);
var results=[vlist,list];
  var vlist=results[0];
  var list=results[1];
  if(!list.length)throw new Error("No driver data for this period.");
  var scored=list.map(function(r){
    var s=calcRisk(r);
    var driverName=r.driver_name||r.driver||"Unknown";
    var matchedVehicle=null;
    for(var i=0;i<vlist.length;i++){if((vlist[i].driver_name||"").toLowerCase()===driverName.toLowerCase()){matchedVehicle=vlist[i];break;}}
    var imei=matchedVehicle?matchedVehicle.imei:(vlist.length>0?vlist[0].imei:"");
    var registration=matchedVehicle?matchedVehicle.registration:(r.object||r.vehicle_no||"");
    return{imei:imei,id:imei,registration:registration,driver_name:driverName,company:r.company_name||r.branch_name||COMPANY,location:matchedVehicle?matchedVehicle.location:"",make:matchedVehicle?matchedVehicle.make:"",features:s.features,risk_score:s.risk_score,risk_band:riskBand(s.risk_score),predicted_loss_cost:lossCost(s.risk_score,annual_km),netstar_driver_score:0,total_distance_km:safe(r.total_running_km||0),running_time:r.total_running_duration||"N/A"};
  });
  var scoredImeis=scored.map(function(s){return s.imei;});
  vlist.forEach(function(v){if(scoredImeis.indexOf(v.imei)<0){scored.push({imei:v.imei,id:v.imei,registration:v.registration,driver_name:v.driver_name||"Unknown",company:v.company,location:v.location,make:v.make,features:{},risk_score:null,risk_band:null,predicted_loss_cost:null,netstar_driver_score:0,total_distance_km:0,running_time:"N/A"});}});
  scored.sort(function(a,b){if(a.risk_score===null)return 1;if(b.risk_score===null)return -1;return b.risk_score-a.risk_score;});
  return json({vehicles:scored,total:scored.length,period_from:start,period_to:end});
}
async function handleTest(url){var start=url.searchParams.get("start")||DATE_FROM;var end=url.searchParams.get("end")||DATE_TO;var q=new URLSearchParams({company_names:COMPANY,location_names:LOCATION,start_date_time:start,end_date_time:end});var res=await fetch(NETSTAR_BASE+"/external/drivers/driver-performance-summary?"+q.toString(),{method:"GET",headers:{"x-api-key":NETSTAR_API_KEY,"Accept":"application/json"}});var text=await res.text();return json({status:res.status,body:text.slice(0,1000)});}

addEventListener("fetch",function(event){event.respondWith(handle(event.request));});

async function handle(request){
  var url=new URL(request.url);
  var method=request.method.toUpperCase();
  if(method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
  var csp={"Content-Security-Policy":"default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"};
  if(url.pathname==="/"||url.pathname===""){
    var html=await fetch(GITHUB_RAW+"/index.html").then(function(r){return r.text();});
    return new Response(html,{status:200,headers:Object.assign({"Content-Type":"text/html;charset=UTF-8"},csp)});
  }
  if(url.pathname==="/roi"){
    var roi=await fetch(GITHUB_RAW+"/roi.html").then(function(r){return r.text();});
    return new Response(roi,{status:200,headers:Object.assign({"Content-Type":"text/html;charset=UTF-8"},csp)});
  }
  if(url.pathname==="/health")return json({status:"ok",version:"5.2"});
  try{
    var p=url.pathname.replace(/\/$/,"");
    if(p==="/vehicles")    return await handleVehicles();
    if(p==="/fleet-scores")return await handleFleetScores(url);
    if(p==="/driver-score")return await handleDriverScore(url);
    if(p==="/test")        return await handleTest(url);
    if(p==="/test-ubi") {
  var res=await fetch("https://ubi-api.netstaraus.com.au/vehicle/vehicles",{method:"GET",headers:{"x-api-key":NETSTAR_API_KEY,"Accept":"application/json"}});
  var text=await res.text();
  return json({status:res.status,body:text.slice(0,1000)});
}return err("Unknown route: "+p,404);
  }catch(e){
    return err("Upstream error: "+e.message,502);
  }
}
