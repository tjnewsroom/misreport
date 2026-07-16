export const NEWS_TYPES = [
  {key:"hl",       label:"Headlines",           color:"#059669", weight:2,  icon:"📰"},
  {key:"vo_sot",   label:"Rundown Vo's",         color:"#2563eb", weight:4,  icon:"✂️"},
  {key:"bite",     label:"Bite",                 color:"#2563eb", weight:2,  icon:"🎙"},
  {key:"minitalks",label:"Mini Talks",           color:"#2563eb", weight:4,  icon:"🎙"},
  {key:"breaking", label:"Breaking",             color:"#dc2626", weight:2,  icon:"⚡"},
  {key:"visuals_breaking",label:"Visuals Breaking",color:"#dc2626",weight:4, icon:"⚡"},
  {key:"justin",   label:"Just In",              color:"#dc2626", weight:2,  icon:"📢"},
  {key:"One_Minute",label:"One Minute",          color:"#64748b", weight:10, icon:"1️⃣"},
  {key:"package",  label:"Package/Story",        color:"#0891b2", weight:25, icon:"🎦"},
  {key:"package_freeze",label:"Package-Freeze",  color:"#0891b2", weight:7, icon:"📺"},
  {key:"programseg01",label:"Program Segment 01",color:"#d97706", weight:40, icon:"🎬"},
  {key:"programseg02",label:"Program Segment 02",color:"#d97706", weight:40, icon:"🎬"},
  {key:"prog_promo",label:"Program Promo",       color:"#7c3aed", weight:30, icon:"📣"},
  {key:"main_promo",label:"Main Promo",          color:"#be185d", weight:200,icon:"🌟"},
  {key:"others",   label:"Others",               color:"#64748b", weight:0,  icon:"📌"},
  {key:"PreRec",label:"PreRec",          color:"#be185d", weight:4,icon:"🎤"},
  {key:"TicTac",label:"TicTac",          color:"#be185d", weight:4,icon:"🎤"},
{key:"RepeatCut",label:"Repeat_Cut",          color:"#be185d", weight:4,icon:"✂️"},

];

export const PROD_FIELDS = [
  {key:"bulletins",          label:"Bulletins Produced",  icon:"📋", color:"#2563eb"},
  {key:"bites",              label:"Bites",               icon:"✂️", color:"#0891b2"},
  {key:"editor_corrections", label:"Editor Corrections",  icon:"🔍", color:"#dc2626"},
  {key:"new_initiatives",    label:"New Initiatives",     icon:"💡", color:"#7c3aed"},
  {key:"story_sourcing",     label:"Stories Sourced",     icon:"🗂",  color:"#d97706"},
  {key:"live_coords",        label:"Live Coordinations",  icon:"📡", color:"#0891b2"},
  {key:"guest_mgmt",         label:"Guest Management",    icon:"🎙", color:"#059669"},
  {key:"rundown_changes",    label:"Rundown Changes",     icon:"🔄", color:"#dc2626"},
  {key:"PreRec",label:"PreRec",          color:"#be185d", weight:4,icon:"🎤"},
  {key:"TicTac",label:"TicTac",          color:"#be185d", weight:4,icon:"🎤"},
  {key:"Repeat_ Cut",label:"Repeat_Cut",          color:"#be185d", weight:4,icon:"✂️"},

];

export const VO_FIELDS = [
  {key:"recordings", label:"Recordings Done",  icon:"🎤", color:"#2563eb"},
  {key:"retakes",    label:"Retakes",           icon:"🔄", color:"#dc2626"},
  {key:"vo_packages",label:"Packages/Stories", icon:"📦", color:"#0891b2"},
  {key:"vo_program", label:"Program",           icon:"🎬", color:"#d97706"},
];

export const QUALITY_ITEMS = [
  {key:"wrong_map",     label:"Wrong Map/Factual Error",  sev:"major", pts:-10, icon:"🗺",  depts:["NLE Editor","News Producer"]},
  {key:"audio",         label:"Audio Issue",              sev:"major", pts:-5,  icon:"🔊", depts:["NLE Editor","Voice Over"]},
  {key:"graphics",      label:"Graphics Mismatch",        sev:"major", pts:-5,  icon:"🖼",  depts:["NLE Editor","News Producer"]},
  {key:"spelling",      label:"Spelling Mistake",         sev:"minor", pts:-2,  icon:"📝", depts:["NLE Editor","News Producer"]},
  {key:"timing",        label:"Timing Sync Issue",        sev:"minor", pts:-2,  icon:"⏱",  depts:["NLE Editor","News Producer"]},
  {key:"qc_reject",     label:"QC Rejection",             sev:"major", pts:-10, icon:"❌", depts:["NLE Editor","News Producer","Voice Over"]},
  {key:"re_edit",       label:"Re-edit Required",         sev:"minor", pts:-3,  icon:"🔁", depts:["NLE Editor"]},
  {key:"broadcast",     label:"Broadcast Notice Issue",   sev:"major", pts:-8,  icon:"📡", depts:["NLE Editor","News Producer"]},
  {key:"visual_mismatch",label:"Visual Mismatch",         sev:"major", pts:-8,  icon:"📺", depts:["News Producer"]},
  {key:"bite_miss",     label:"Bite Not Picked on Time",  sev:"major", pts:-5,  icon:"✂️", depts:["News Producer"]},
  {key:"onair_error",   label:"On-Air Error",             sev:"major", pts:-10, icon:"🔴", depts:["News Producer"]},
  {key:"rundown_late",  label:"Rundown Sent Late",        sev:"minor", pts:-3,  icon:"⏰", depts:["News Producer"]},
  {key:"vo_mistake",    label:"VO Recording Mistake",     sev:"minor", pts:-3,  icon:"🎙", depts:["Voice Over"]},
  {key:"PreRec",label:"PreRec", sev:"minor", pts:4,icon:"🎤",depts:["NLE Editor","News Producer"]},
  {key:"TicTac",label:"TicTac", sev:"minor", pts:4,icon:"🎤",depts:["NLE Editor","News Producer"]},

];

export const REL_ITEMS = [
  {key:"on_time",    label:"On-time Delivery",   icon:"⏰"},
  {key:"emergency",  label:"Emergency Response", icon:"🚨"},
  {key:"team_coord", label:"Team Coordination",  icon:"🤝"},
  {key:"night_shift",label:"Night Shift Support",icon:"🌙"},
  {key:"pressure",   label:"Pressure Handling",  icon:"💪"},
];

export const BREAK_TYPES = [
  {key:"lunch",    label:"Lunch Break",    icon:"🍱", color:"#d97706"},
  {key:"tea",      label:"Tea Break",      icon:"☕", color:"#059669"},
  {key:"personal", label:"Personal Break", icon:"🚶", color:"#7c3aed"},
  {key:"other",    label:"Other Break",    icon:"⏸",  color:"#64748b"},
];

export const SHIFT_OPTS = [
  {v:"",                   lbl:"— —",               cls:"sem"},
  {v:"1ST",                lbl:"1ST",               cls:"s1"},
  {v:"2ND",                lbl:"2ND",               cls:"s2"},
  {v:"NIGHT",              lbl:"NIGHT",             cls:"sn"},
  {v:"GEN",                lbl:"GEN",               cls:"sg2"},
  {v:"MN",                 lbl:"MN",                cls:"smn"},
  {v:"OFF",                lbl:"OFF",               cls:"sof"},
  {v:"COMP_HOL",           lbl:"COMP(H)",           cls:"scp"},
  {v:"COMP_WEEK",          lbl:"COMP(W)",           cls:"scp"},
  {v:"CL",                 lbl:"CL",                cls:"scl"},
  {v:"SL",                 lbl:"SL",                cls:"ssl"},
  {v:"PL",                 lbl:"PL",                cls:"spl"},
  {v:"LOP",                lbl:"LOP",               cls:"slp"},
  {v:"HOL",                lbl:"HOL",               cls:"shl"},
  {v:"OFFREQUESTED",       lbl:"OFFREQUESTED",      cls:"sswap"},
  {v:"1STSHIFTREQUESTED",  lbl:"1STSHIFTREQUESTED", cls:"sswap"},
  {v:"2NDSHIFTREQUESTED",  lbl:"2NDSHIFTREQUESTED", cls:"sswap"},
];

export const SH_CLS = {
  "1ST":"s1","2ND":"s2","NIGHT":"sn","GEN":"sg2","MN":"smn",
  "OFF":"sof","COMP_HOL":"scp","COMP_WEEK":"scp",
  "CL":"scl","SL":"ssl","PL":"spl","LOP":"slp","HOL":"shl",
  "OFFREQUESTED":"sswap","1STSHIFTREQUESTED":"sswap","2NDSHIFTREQUESTED":"sswap"
};

export const DEPTS = ["NLE Editor","News Producer","Voice Over"];

export const SH_MAP = {
  '2ND SHIFT':'2ND','1ST SHIFT':'1ST','NIGHT':'NIGHT','OFF':'OFF',
  'OFFREQUESTED':'OFFREQUESTED','-1STSHIFTREQUESTED':'1STSHIFTREQUESTED',
  '-2NDSHIFTREQUESTED':'2NDSHIFTREQUESTED','1STSHIFTREQUESTED':'1STSHIFTREQUESTED',
  '2NDSHIFTREQUESTED':'2NDSHIFTREQUESTED','NOON SHIFT':'MN','GEN':'GEN',
  'COMP_HOL':'COMP_HOL','COMP_WEEK':'COMP_WEEK','CL':'CL','SL':'SL',
  'PL':'PL','LOP':'LOP','HOL':'HOL'
};
