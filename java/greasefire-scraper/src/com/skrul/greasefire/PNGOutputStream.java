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

    double width = Math.ceil(Math.sqrt(size));
    
    BufferedImage bi = new BufferedImage((int) width, (int) width, BufferedImage.TYPE_INT_RGB);
    int pos = 0;
    for (int y = 0; y < width; y++) {
      for (int x = 0; x < width; x++) {
        int r = pos < bytes.length ? bytes[pos] : 0;
        int g = pos + 1 < bytes.length ? bytes[pos + 1] : 0;
        int b = pos + 2 < bytes.length ? bytes[pos + 2] : 0;
        int value = ((r & 0xFF) << 16) | ((g & 0xFF) << 8)  | ((b & 0xFF) << 0);
        bi.setRGB(x, y, value);
        pos += 3;
      }
    }
    ImageIO.write(bi, "png", this.outputFile);
  }
  
  @Override
  public void write(int b) throws IOException {
    this.os.write(b);
  }

}
