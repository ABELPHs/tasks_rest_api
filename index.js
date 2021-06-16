const functions = require("firebase-functions");
const admin=require('firebase-admin');
const express=require('express');
const app=express();

// Valida idToken
const authenticate = async (req, res, next) => {
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      res.status(403).json({'error':'no valid key'});
      return;
    }
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
      const decodedIdToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedIdToken;
      next();
      return;
    } catch(e) {
      res.status(403).json({'error':'session ended'});
      return;
    }
};
  
app.use(authenticate);

admin.initializeApp({
    credential:admin.credential.applicationDefault(),
    databaseURL:'http://abelph-d3b1e.firebase.com'
});
const db=admin.firestore();

// Retorna todas las tareas del usuario
app.get('/api/tasks',async (req,res)=>{
    try{
    const doc= db.collection("tasks").where("author", "==", req.user.uid);
    const querySnapshot=await doc.get();
    const response=querySnapshot.docs.map(info=>({
        id:info.id,
        title:info.data()['title'],
        description:info.data()['description'],
        isCompleted:info.data()['isCompleted'],
        endDate:info.data()['endDate'],
        comments:info.data()['comments'],
        responsable:info.data()['responsable'],
        tags:info.data()['tags']
    }))
    return res.status(200).json(response);
    }catch(except){
        return res.status(500).send(except);
    }
});

// Retorna toda la informacion de una tarea
app.get('/api/tasks/:task_id',async (req,res)=>{
    try{
    const doc= db.collection('tasks').doc(req.params.task_id);
    const item=await doc.get();
    if(item.data()['author']==req.user.uid /* Validacion de acceso a la tarea */){
        const response={
            title:item.data()['title'],
            description:item.data()['description'],
            isCompleted:item.data()['isCompleted'],
            endDate:item.data()['endDate'],
            comments:item.data()['comments'],
            responsable:item.data()['responsable'],
            tags:item.data()['tags']
        };
        return res.status(200).json(response);
    }else{
        res.status(403).json({'error':'Unauthorized'});
    }
    }catch(except){
        return res.status(500).send(except);
    }
});

// Crea una nueva tarea 
app.post('/api/tasks',async (req,res)=>{
    try{
    if(req.body.title!=null&&req.body.description!=null&&req.body.isCompleted!=null&&req.body.endDate!=null /* Validacion de parámetros mandatorios */){
    await db.collection('tasks').doc().create({
        author:req.user.uid,
        title:req.body.title,
        description:req.body.description,
        isCompleted:req.body.isCompleted,
        endDate:req.body.endDate,
        comments:(req.body.comments!=null)?req.body.comments:'',
        responsable:(req.body.responsable!=null)?req.body.responsable:'',
        tags:(req.body.tags!=null)?req.body.tags:''
    });
    return res.status(204).json();
    }else{
       return res.status(400).json({"error":"Mandatory parameters"});
    }
    }catch(except){
        return res.status(500).send(except);
    }
});

// Modifica una tarea del usuario
app.put('/api/tasks/:task_id',async(req,res)=>{
    try{
        if((req.body.title!=null&&req.body.description!=null&&req.body.isCompleted!=null&&req.body.endDate!=null)&&comprobar('author',req.user.uid,'tasks',req.params.task_id)){
                const document= db.collection('tasks').doc(req.params.task_id);
                await document.update({
                    author:req.user.uid,
                    title:req.body.title,
                    description:req.body.description,
                    isCompleted:req.body.isCompleted,
                    endDate:req.body.endDate,
                    comments:(req.body.comments!=null)?req.body.comments:'',
                    responsable:(req.body.responsable!=null)?req.body.responsable:'',
                    tags:(req.body.tags!=null)?req.body.tags:''
                });
                return res.status(200).json()
        }else{
            return res.status(400).json({"error":"Mandatory parameters or Unauthorized"});
        }
        }catch(except){
            return res.status(500).send(except);
        }
}
)

// Elimina una tarea del usuario
app.delete('/api/tasks/:task_id',async (req,res)=>{
    try{
        if(comprobar('author',req.user.uid,'tasks',req.params.task_id) /* Validacion de acceso */){
            const document= db.collection('tasks').doc(req.params.task_id);
            await document.delete();
            return res.status(200).json();
        }else{
            res.status(403).json({'error':'Unauthorized'});
        }
    }catch(except){
        return res.status(500).json(except);
    }
});

exports.app=functions.https.onRequest(app);

//Función  para validar acceso a un documento
async function comprobar(dbvalue /*ID cliente en db*/,requestvalue /*ID cliente*/,collection/*Coleccion en db*/,document/*Id documento*/){
    const doc= db.collection(collection).doc(document);
    const item=await doc.get();
    if(item.data()[dbvalue]==requestvalue){
        return true;
    }
    return false;
}