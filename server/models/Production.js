const mongoose = require('mongoose');

const productionSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'current_production_state', unique: true },
    productName: { type: String, default: 'PROTEUS' },
    shift: { type: String, default: '' },
    shiftMode: { type: String, default: 'auto' },
    lastUpdated: { type: String, default: '' },
    stages: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true, minimize: false, strict: false }
);

module.exports = mongoose.model('ProductionState', productionSchema);
