const r=require("express").Router(),s=require("../services/sanctionHistoryService"),{requireAdmin}=require("../middlewares/requireAdmin");
r.get("/admin/sanciones-historial",requireAdmin,async(q,x,n)=>{try{x.json(await s.list(q.query))}catch(e){n(e)}});
r.get("/admin/sanciones-historial/:id",requireAdmin,async(q,x,n)=>{try{x.json(await s.detail(q.params.id))}catch(e){n(e)}});
module.exports=r;
