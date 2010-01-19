package com.skrul.greasefire;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;

import javax.imageio.ImageIO;

public class PNGOutputStream extends OutputStream {

  private File outputFile;
  private ByteArrayOutputStream os;
  
  public PNGOutputStream(File outputFile) {
    this.outputFile = outputFile;
    this.os = new ByteArrayOutputStream();
  }

  @Override
  public void close() throws IOException {
    byte[] bytes = this.os.toByteArray();
    double size = bytes.length / 3.0;
    if (size - Math.floor(size) > 0)
      size++;

    BufferedImage bi = new BufferedImage((int) size, 1, BufferedImage.TYPE_INT_RGB);
    int pos = 0;
    for (int i = 0; i < bytes.length; i += 3) {
      int r = bytes[i];
      int g = i + 1 < bytes.length ? bytes[i + 1] : 0;
      int b = i + 2 < bytes.length ? bytes[i + 2] : 0;
      int value = ((r & 0xFF) << 16) | ((g & 0xFF) << 8)  | ((b & 0xFF) << 0);
      bi.setRGB(pos, 0, value);
      pos++;
    }
    ImageIO.write(bi, "png", this.outputFile);
  }
  
  @Override
  public void write(int b) throws IOException {
    this.os.write(b);
  }

}
