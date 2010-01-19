package com.skrul.greasefire;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;

import javax.imageio.ImageIO;

public class GrayPNGOutputStream extends OutputStream {

  private File outputFile;
  private ByteArrayOutputStream os;
  
  public GrayPNGOutputStream(File outputFile) {
    this.outputFile = outputFile;
    this.os = new ByteArrayOutputStream();
  }

  @Override
  public void close() throws IOException {
    byte[] bytes = this.os.toByteArray();
    BufferedImage bi = new BufferedImage(bytes.length, 1, BufferedImage.TYPE_BYTE_GRAY);
    for (int i = 0; i < bytes.length; i++) {
      int b = bytes[i];
      int value = ((b & 0xFF) << 16) | ((b & 0xFF) << 8)  | ((b & 0xFF) << 0);
      bi.setRGB(i, 0, value);
      System.out.println(i + " " + value);
    }

    /*
    ImageTypeSpecifier type = ImageTypeSpecifier.createFromRenderedImage(bi);
    Iterator iter = ImageIO.getImageWriters(type, "png");
    ImageWriter writer = (ImageWriter) iter.next();
    ImageWriteParam param = writer.getDefaultWriteParam();
     */
    ImageIO.write(bi, "PNG", this.outputFile);
  }
  
  @Override
  public void write(int b) throws IOException {
    this.os.write(b);
  }

}
