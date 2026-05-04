const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.body = '[deleted]';
    delete obj.sender;
  }
  return obj;
};

module.exports = mongoose.model('Message', messageSchema);