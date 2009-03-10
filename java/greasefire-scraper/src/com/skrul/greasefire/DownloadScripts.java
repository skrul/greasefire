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
    String url = "http://userscripts.org/scripts?page=";
    int page = 1;
    boolean done = false;
    while (!done && page < 1000) {
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
                    
          HttpMethod method = new GetMethod("http://userscripts.org/scripts/source/" + script.id + ".user.js?greasefire");
          try {
            client.executeMethod(method);
            String source = method.getResponseBodyAsString();
            FileWriter writer = new FileWriter(scriptFile);
            writer.write(source);
            writer.close();

            p.setProperty("id", script.id);
            p.setProperty("installs", Integer.toString(script.installs));
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

      // I should be shot for this
      String regexp = "/scripts/source/(\\d+)\\.user\\.js.*?"
          + "<td class='inv lp'>\\d+</td>.*?"
          + "<td class='inv lp'>(\\d+)</td>.*?" + "title='([^']+)'";

      Pattern scriptsRegexp = Pattern.compile(regexp, Pattern.DOTALL);
      Matcher matcher = scriptsRegexp.matcher(response);

      while (matcher.find()) {
        Script script = new Script();
        script.url = matcher.group(1);
        script.installs = Integer.parseInt(matcher.group(2));
        String d = matcher.group(3).replace("Z", "-0000");
        script.updated = sdf.parse(d).getTime();
        script.id = script.url.substring(script.url.lastIndexOf("/") + 1);

        scripts.add(script);
      }
    } catch (IOException e) {
      logger.log(Level.SEVERE, url, e);
    } catch (ParseException e) {
      logger.log(Level.SEVERE, url, e);
    }

    return scripts;
  }

  class Script {
    String url;
    int installs;
    long updated;
    String id;
  }
}
