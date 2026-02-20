import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = express.Router();

router.get('/', authRequired, adminOnly, async (req,res)=>{
  const users = await User.find({}, { passwordHash:0 }).sort({ createdAt:-1 });
  res.json(users);
});

router.patch('/me', authRequired, async (req,res)=>{
  try{
    console.log('PATCH /users/me payload:', req.body);
    const { name, username, address, phone } = req.body;
    const userId = req.user.id;
    const current = await User.findById(userId);
    if(!current) return res.status(404).json({ error:'Not found' });
    if(typeof username==='string' && username !== current.username){
      const exists = await User.findOne({ username });
      if(exists) return res.status(400).json({ error:'El usuario ya existe' });
      current.username = username;
    }
    if(typeof name==='string') current.name = name;
    if(typeof address==='string') current.address = address;
    if(typeof phone==='string') current.phone = phone;
    await current.save();
    const { passwordHash, ...safe } = current.toObject();
    res.json(safe);
  }catch(err){ res.status(400).json({ error: err.message || 'Update error' }); }
});

export default router;
