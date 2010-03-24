function BinaryStream(data) {
  this.pos_ = 0;
  this.length_ = data.length;
  this.data_ = data;
}

BinaryStream.prototype = {
  getb_: function() {
    if (this.pos_ >= this.length_)
      throw new Error("out of bounds");

    var b = this.data_.charCodeAt(this.pos_);
    this.pos_++;
    return b;
  },

  length: function() {
    return this.length_;
  },

  seek: function(pos) {
    if (pos >= this.length_)
      throw new Error("out of bounds");
    this.pos_ = pos;
  },

  read8: function() {
    return this.getb_();
  },

  read16: function() {
    return (this.getb_() << 8) + this.getb_();
  },

  read64: function() {
    return (this.getb_() << 56) +
      (this.getb_() << 48) +
      (this.getb_() << 40) +
      (this.getb_() << 32) +
      (this.getb_() << 24) +
      (this.getb_() << 16) +
      (this.getb_() <<  8) +
      this.getb_();
  }
}

