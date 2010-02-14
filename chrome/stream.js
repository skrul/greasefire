function Stream() {
  this.pos_ = 0;
  this.length_ = 0;
  this.canvas_ = null;
  this.data_ = null;
}

Stream.prototype = {
  getb_: function() {
    if (this.pos_ >= this.length_)
      throw new Error("out of bounds");

    var b = this.data_[this.pos_ + Math.floor(this.pos_ / 3)];
    this.pos_++;
    return b;
  },

  load: function(document, url, callback) {
    var image = new Image();
    var that = this;
    image.onload = function() {
      that.length_ = image.width * image.height * 3;
      that.canvas_ = document.createElement("canvas");
      that.canvas_.width = image.width;
      that.canvas_.height = image.height;
      var context = that.canvas_.getContext("2d");
      context.drawImage(image, 0, 0, image.width, image.height);
      that.data_ = context.getImageData(0, 0, image.width, image.height).data;
      that.pos_ = 0;
      callback();
    }
    image.src = url;
  },

  getDataUrl: function() {
    return this.canvas_.toDataURL();
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

