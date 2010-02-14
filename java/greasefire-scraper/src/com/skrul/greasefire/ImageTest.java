package com.skrul.greasefire;

import java.io.File;

public class ImageTest {

  /**
   * @param args
   */
  public static void main(String[] args) throws Exception {

    PNGOutputStream os = new PNGOutputStream(new File("testimage.png"));
    for (int i = 0; i < 256; i++) {
      os.write(i);
    }
    os.close();
  }

}
