package com.skrul.greasefire;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.httpclient.HttpClient;
import org.apache.commons.httpclient.HttpMethod;
import org.apache.commons.httpclient.methods.GetMethod;
import org.htmlcleaner.HtmlCleaner;
import org.htmlcleaner.TagNode;
import org.htmlcleaner.XPatherException;

public class DownloadScripts {

  public static final Logger logger = Logger.getLogger(DownloadScripts.class.getName());
  private static final SimpleDateFormat sdf =
      new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ");

  public static void main(String[] args) throws Exception {

    if (args.length != 2) {
      System.out.println("usage: downloadscripts [destinationdir] [full|new]");
      System.exit(1);
    }
    
    File dir = new File(args[0]);
    if (!(dir.isDirectory() && dir.exists())) {
      throw new RuntimeException("Directory '" + dir.getPath() + "' does not exist");
    }

    boolean full = args[1].equals("full");
    
    logger.info("Saving to '" + dir.getPath() + "'");
    
    DownloadScripts da = new DownloadScripts();
    da.run(dir, full);
  }

  public void run(File dir, boolean full) {

    HttpClient client = new HttpClient();
    String url = "http://greasefire.userscripts.org/scripts?page=";
    int page = 1;
    boolean done = false;
    while (!done && page < 1500) {
      List<Script> scripts = getScripts(client, url + page);
      logger.info("page: " + page + " " + scripts.size() + " scripts");
      if (scripts.size() == 0) {
        break;
      }

      boolean hasUpdatedScripts = false;
      for (Script script : scripts) {

        try {
          File props = new File(dir, script.id + ".props");
          File scriptFile = new File(dir, script.id + ".js");

          Properties p = new Properties();
          if (props.exists() && scriptFile.exists()) {
            FileInputStream fis = new FileInputStream(props);
            p.load(fis);
            
            // TODO: Compute file hash (use file size for now)
            String fileHash = Long.toString(scriptFile.length());
            long updated = Long.parseLong(p.getProperty("updated"));
            String savedHash = p.getProperty("hash");

            if (script.updated <= updated && savedHash != null && savedHash.equals(fileHash)) {

              // Update the install count
              p.setProperty("installs", Integer.toString(script.installs));
              p.store(new FileOutputStream(props), "");
              
              continue;
            }
          }

          hasUpdatedScripts = true;
          
          logger.info("page: " + page + " " + script.url + " "
              + script.installs + " " + script.updated);
                    
          HttpMethod method = new GetMethod("http://greasefire.userscripts.org/scripts/source/" + script.id + ".user.js?greasefire");
          try {
            client.executeMethod(method);
            String source = method.getResponseBodyAsString();
            FileWriter writer = new FileWriter(scriptFile);
            writer.write(source);
            writer.close();

            p.setProperty("id", script.id);
            p.setProperty("installs", Integer.toString(script.installs));
            p.setProperty("fans", Integer.toString(script.fans));
            p.setProperty("posts", Integer.toString(script.posts));
            p.setProperty("updated", Long.toString(script.updated));
            p.setProperty("hash", Long.toString(scriptFile.length()));
            p.store(new FileOutputStream(props), "");
                    
          } catch (IOException e) {
            logger.severe(script + " " + e.getMessage());
            props.delete();
            scriptFile.delete();
          }

          try {
            Thread.sleep(2000);
          } catch (InterruptedException e) {
          }

        } catch (IOException e) {
          logger.log(Level.SEVERE, script.url, e);
        }
      }

      if (!full && !hasUpdatedScripts) {
        done = true;
      }
      
      page++;
    }
  }

  public List<Script> getScripts(HttpClient client, String url) {

    HttpMethod method = new GetMethod(url);
    List<Script> scripts = new ArrayList<Script>();

    try {

      int statusCode = client.executeMethod(method);
      if (statusCode != 200) {
        throw new RuntimeException("Failed to get page: " + statusCode);
      }
      String response = method.getResponseBodyAsString();
      HtmlCleaner html = new HtmlCleaner();
      TagNode content = html.clean(response).findElementByAttValue("id", "content", true, false);
      Object[] rows = content.evaluateXPath("table/tbody/tr[@id]");
      for (Object row: rows) {
        if (!(row instanceof TagNode)) {
          continue;
        }
        TagNode rowNode = (TagNode) row;
        try {
          Script script = new Script();
          String id = rowNode.getAttributeByName("id").replace("scripts-", "");        
          TagNode nameNode = rowNode.getChildTags()[0].getChildTags()[0];
          String scriptUrl = nameNode.getAttributeByName("href");         
          int posts = Integer.parseInt(rowNode.getChildTags()[2].getText().toString());
          int fans = Integer.parseInt(rowNode.getChildTags()[3].getText().toString());
          int installs = Integer.parseInt(rowNode.getChildTags()[4].getText().toString());
          TagNode updatedNode = rowNode.getChildTags()[5];
          String dateString = updatedNode.getChildTags()[0].getAttributeByName("title").replace("Z", "-0000");

          script.id = id;
          script.url = scriptUrl;
          script.updated = sdf.parse(dateString).getTime();          
          script.installs = installs;
          script.posts = posts;
          script.fans = fans;
          scripts.add(script);
        } catch (Exception e) {
          logger.log(Level.SEVERE, "Can't parse row " + rowNode, e);
        }
      }
    } catch (Exception e) {
      logger.log(Level.SEVERE, url, e);
    }
    return scripts;
  }

  class Script {
    String url;
    int installs;
    int posts;
    int fans;
    long updated;
    String id;
  }
}
