import express from 'express';
import { Op } from 'sequelize';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { User } from '../models/index.js';

const router = express.Router();

router.get('/', authRequired, adminOnly, async (req,res)=>{
  const list = await User.findAll({ attributes: { exclude: ['passwordHash'] } });
  res.json(list);
});

router.put('/me', authRequired, async (req,res)=>{
  try{
    const { name, email, address, phone, username } = req.body;
    const current = await User.findByPk(req.user.id);
    if(!current) return res.status(404).json({ error:'Not found' });
    // Check if new username is already taken by another user
    if (username && username !== current.username) {
      const exists = await User.findOne({ where: { username, id: { [Op.ne]: current.id } } });
      if (exists) return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }
    if(name) current.name = name;
    if(email) current.email = email;
    if(address!==undefined) current.address = address;
    if(phone!==undefined) current.phone = phone;
    if(username) current.username = username;
    await current.save();
    const json = current.toJSON();
    delete json.passwordHash;
    res.json(json);
  }catch(err){ res.status(400).json({ error:err.message }); }
});

export default router;
