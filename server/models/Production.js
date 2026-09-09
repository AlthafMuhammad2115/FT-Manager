const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    serial: { type: String, required: true },
    num: { type: Number, required: true },
    assembly: { type: String, enum: ['pending', 'done'], default: 'pending' },
    ft: { type: String, enum: ['pending', 'done'], default: 'pending' },
    dlc: { type: String, enum: ['pending', 'done'], default: 'pending' },
    oqc: { type: String, enum: ['pending', 'done'], default: 'pending' },
    shipment: { type: String, enum: ['pending', 'done'], default: 'pending' }
  },
  { _id: false }
);

const productionSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'current_production_state', unique: true },
    productName: { type: String, default: 'PROTEUS' },
    prefix: { type: String, default: 'PST' },
    startNum: { type: Number, default: 20001 },
    dailyTarget: { type: Number, default: 50 },
    shift: { type: String, default: '' },
    shiftMode: { type: String, default: 'auto' },
    lastUpdated: { type: String, default: '' },
    units: { type: [unitSchema], default: [] }
  },
  { timestamps: true, minimize: false, strict: false }
);

module.exports = mongoose.model('ProductionState', productionSchema);
