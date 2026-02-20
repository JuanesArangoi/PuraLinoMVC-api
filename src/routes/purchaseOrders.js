import express from 'express';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockMovement } from '../models/StockMovement.js';

const router = express.Router();

// ── Generate sequential PO number ──
async function nextPONumber() {
  const last = await PurchaseOrder.findOne().sort({ createdAt: -1 });
  if (!last) return 'ALB-0001';
  const match = last.poNumber.match(/ALB-(\d+)/);
  const num = match ? parseInt(match[1]) + 1 : 1;
  return `ALB-${String(num).padStart(4, '0')}`;
}

// List all purchase orders
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const list = await PurchaseOrder.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one PO
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Albarán no encontrado' });
    res.json(po);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create PO (albarán)
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { supplierId, supplierName, items, notes, expectedDate } = req.body;
    if (!supplierId) return res.status(400).json({ error: 'Selecciona un proveedor' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Agrega al menos un producto' });

    // Validate each item
    for (const it of items) {
      if (!it.productId && !it.isNewProduct) return res.status(400).json({ error: 'Cada línea debe tener un producto o ser marcada como producto nuevo' });
      if (!it.productName) return res.status(400).json({ error: 'Cada línea debe tener un nombre de producto' });
      if (!it.quantityOrdered || it.quantityOrdered < 1) return res.status(400).json({ error: `Cantidad inválida para ${it.productName || 'un producto'}` });
    }

    const poNumber = await nextPONumber();
    const totalCost = items.reduce((s, it) => s + (it.unitCost || 0) * it.quantityOrdered, 0);

    const po = await PurchaseOrder.create({
      poNumber,
      supplierId,
      supplierName,
      items: items.map(it => ({
        productId: it.productId || null,
        productName: it.productName,
        variantId: it.variantId || null,
        variantLabel: it.variantLabel || '',
        quantityOrdered: it.quantityOrdered,
        unitCost: it.unitCost || 0,
        quantityReceived: 0,
        isNewProduct: it.isNewProduct || false,
        newProductData: it.isNewProduct ? {
          price: it.newProductData?.price || it.unitCost || 0,
          category: it.newProductData?.category || 'ropa',
          description: it.newProductData?.description || '',
          variants: it.newProductData?.variants || []
        } : undefined
      })),
      notes,
      expectedDate: expectedDate || null,
      totalCost,
      status: 'borrador'
    });
    res.json(po);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update PO status (e.g. mark as sent)
router.patch('/:id/status', authRequired, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!po) return res.status(404).json({ error: 'Albarán no encontrado' });
    res.json(po);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Update PO (edit items/notes while in borrador)
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Albarán no encontrado' });
    if (po.status !== 'borrador') return res.status(400).json({ error: 'Solo se pueden editar albaranes en estado borrador' });

    const { items, notes, expectedDate, supplierId, supplierName } = req.body;
    if (items) {
      po.items = items;
      po.totalCost = items.reduce((s, it) => s + (it.unitCost || 0) * (it.quantityOrdered || 0), 0);
    }
    if (notes !== undefined) po.notes = notes;
    if (expectedDate !== undefined) po.expectedDate = expectedDate;
    if (supplierId) po.supplierId = supplierId;
    if (supplierName) po.supplierName = supplierName;
    await po.save();
    res.json(po);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Receive goods (register received quantities + assign warehouse/shelf) ──
router.post('/:id/receive', authRequired, adminOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Albarán no encontrado' });
    if (po.status === 'cancelado') return res.status(400).json({ error: 'Albarán cancelado' });

    const { receivedItems } = req.body;
    // receivedItems: [{ itemId, quantityReceived, warehouseId, shelfId }]
    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      return res.status(400).json({ error: 'No hay ítems para recibir' });
    }

    const discrepancies = [];
    const movements = [];

    for (const ri of receivedItems) {
      const poItem = po.items.id(ri.itemId);
      if (!poItem) continue;

      const qtyReceiving = Number(ri.quantityReceived) || 0;
      if (qtyReceiving <= 0) continue;

      poItem.quantityReceived = (poItem.quantityReceived || 0) + qtyReceiving;
      poItem.warehouseId = ri.warehouseId || poItem.warehouseId;
      poItem.shelfId = ri.shelfId || poItem.shelfId;
      poItem.receivedAt = new Date();

      // Check discrepancy
      if (poItem.quantityReceived < poItem.quantityOrdered) {
        discrepancies.push({
          productName: poItem.productName,
          variantLabel: poItem.variantLabel,
          ordered: poItem.quantityOrdered,
          received: poItem.quantityReceived,
          missing: poItem.quantityOrdered - poItem.quantityReceived
        });
      } else if (poItem.quantityReceived > poItem.quantityOrdered) {
        discrepancies.push({
          productName: poItem.productName,
          variantLabel: poItem.variantLabel,
          ordered: poItem.quantityOrdered,
          received: poItem.quantityReceived,
          excess: poItem.quantityReceived - poItem.quantityOrdered
        });
      }

      // Update product stock — auto-create if new product
      let product = poItem.productId ? await Product.findById(poItem.productId) : null;

      if (!product && poItem.isNewProduct) {
        // Auto-create the product with variants and their stock
        const npd = poItem.newProductData || {};
        const hasVariants = Array.isArray(npd.variants) && npd.variants.length > 0;
        const variantsWithStock = hasVariants
          ? npd.variants.map(v => ({ size: v.size, color: v.color, stock: v.stock || 0 }))
          : [];
        const totalVariantStock = variantsWithStock.reduce((s, v) => s + v.stock, 0);

        const newProd = await Product.create({
          name: poItem.productName,
          price: npd.price || poItem.unitCost || 0,
          category: npd.category || 'ropa',
          description: npd.description || '',
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          stock: hasVariants ? 0 : qtyReceiving,
          variants: variantsWithStock
        });
        product = newProd;
        poItem.productId = newProd._id;
        // Stock already set on creation, skip further update for new products
      } else if (product) {
        if (poItem.variantId) {
          const v = product.variants.id(poItem.variantId);
          if (v) v.stock = (v.stock || 0) + qtyReceiving;
        } else {
          product.stock = (product.stock || 0) + qtyReceiving;
        }
        await product.save();
      }

      // Get warehouse/shelf names for the movement record
      let warehouseName = '', shelfCode = '';
      if (ri.warehouseId) {
        const wh = await Warehouse.findById(ri.warehouseId);
        if (wh) {
          warehouseName = wh.name;
          if (ri.shelfId) {
            const shelf = wh.shelves.id(ri.shelfId);
            if (shelf) shelfCode = shelf.code;
          }
        }
      }

      // Record stock movement
      movements.push({
        productId: poItem.productId,
        productName: poItem.productName,
        variantId: poItem.variantId,
        variantLabel: poItem.variantLabel,
        type: 'entrada',
        quantity: qtyReceiving,
        reason: `Recepción albarán ${po.poNumber}`,
        referenceType: 'purchase_order',
        referenceId: po._id,
        warehouseId: ri.warehouseId || null,
        warehouseName,
        shelfCode,
        userId: req.user.id,
        userName: req.user.name || ''
      });
    }

    // Save stock movements
    if (movements.length > 0) await StockMovement.insertMany(movements);

    // Update PO status
    const allReceived = po.items.every(it => it.quantityReceived >= it.quantityOrdered);
    const someReceived = po.items.some(it => it.quantityReceived > 0);
    if (allReceived) po.status = 'completo';
    else if (someReceived) po.status = 'parcial';

    await po.save();

    res.json({
      purchaseOrder: po,
      discrepancies,
      movementsCreated: movements.length
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Delete PO (only if borrador)
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Albarán no encontrado' });
    if (po.status !== 'borrador') return res.status(400).json({ error: 'Solo se pueden eliminar albaranes en estado borrador' });
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
