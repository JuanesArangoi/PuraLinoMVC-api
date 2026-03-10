import bcrypt from 'bcryptjs';
import { User, Product, Promotion } from './models/index.js';

export async function seedIfEmpty(){
  const users = await User.count();
  if(users===0){
    const adminPass = await bcrypt.hash('123', 10);
    const clientPass = await bcrypt.hash('321', 10);
    await User.bulkCreate([
      { username:'Diego', passwordHash:adminPass, role:'admin', name:'Diego Admin' },
      { username:'Esteban', passwordHash:clientPass, role:'client', name:'Esteban Cliente', email:'esteban@email.com' }
    ]);
  }
  const products = await Product.count();
  if(products===0){
    await Product.bulkCreate([
      { name:'Camisa de Lino', price:189000, category:'ropa', stock:15, description:'Camisa premium de lino' },
      { name:'Vestido de Lino', price:259000, category:'ropa', stock:10, description:'Vestido elegante de lino' },
      { name:'Manteles de Lino', price:119000, category:'hogar', stock:20, description:'Hermosos manteles de lino' },
      { name:'Juego de Servilletas', price:69000, category:'hogar', stock:25, description:'Juego de 4 servilletas' },
      { name:'Pantalones de Lino', price:199000, category:'ropa', stock:12, description:'Pantalones cómodos de lino' },
      { name:'Ropa de Cama Lino', price:399000, category:'hogar', stock:8, description:'Juego completo de ropa de cama' }
    ]);
  }
  const promotions = await Promotion.count();
  if(promotions===0){
    await Promotion.bulkCreate([
      { code:'LINEN10', discount:10, active:true },
      { code:'VERANO20', discount:20, active:true }
    ]);
  }
}
