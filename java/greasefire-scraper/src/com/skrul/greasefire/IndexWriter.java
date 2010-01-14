package com.skrul.greasefire;

import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class IndexWriter {

	private Node root;
	private Pattern tldPattern = Pattern.compile("^(^(?:[^/]*)(?://)?(?:[^/]*))(\\.tld)((?:/.*)?)$");
	
	public IndexWriter() {
		root = new Node();
	}

	public void addMatch(int id, String url) {

		// Replace the .tld with a space
		Matcher m = tldPattern.matcher(url);
		if (m.matches()) {
			url = m.group(1) + ". " + m.group(3);
		}
		
		Node current = root;
		for (int i = 0; i < url.length(); i++) {
			char c = url.charAt(i);
			current = current.addChild(c);
		}
		current.addId(id);
	}
	
	public void serialize(OutputStream os) throws Exception {
		
		Queue<Node> queue = new LinkedList<Node>();
		queue.add(root);

		List<Node> nodes = new ArrayList<Node>();

		int pos = 0;
		while (queue.size() > 0) {
			Node node = queue.remove();
			nodes.add(node);
			
			node.pos = pos;
			
			// eight bytes for id length
			pos += 8;
			
			// eight bytes per id
			if (node.ids != null) {
				pos += node.ids.size() * 8;
			}
			
			// two bytes for children length
			pos += 2;

			// 10 bytes for each child (2 for the char, 8 for the pointer)
			pos += node.children.size() * 10;

			queue.addAll(node.children.values());
		}

		BufferedOutputStream bos = new BufferedOutputStream(os, 4096);
		DataOutputStream dos = new DataOutputStream(bos);

		int bytes = 0;
		for(Node node: nodes) {

			//System.out.print("pos: " + node.pos + " (" + bytes + ")");
			
			if (node.ids == null) {
				dos.writeLong(0);
				bytes += 8;
			}
			else {
				dos.writeLong(node.ids.size());
				bytes += 8;
				for (int id: node.ids) {
					dos.writeLong(id);
					bytes += 8;
				}
			}
			//System.out.print(" ids: " + node.ids);

			//System.out.print(" children: ");
			dos.writeShort(node.children.size());
			bytes += 2;
			for (char c: node.children.keySet()) {
				Node child = node.children.get(c);
				dos.writeChar(c);
				bytes += 2;
				dos.writeLong(child.pos);
				bytes += 8;
				//System.out.print(c + " " + child.pos + " ");
			}
			//System.out.println("");
		}
		bos.close();
		dos.close();
	}

  public static void json(Node n, StringBuffer s) {

    s.append('{');

    if (n.ids != null) {
      s.append("\" \":");
      int size = n.ids.size();
      Integer[] ids = new Integer[size];
      ids = n.ids.toArray(ids);
      s.append('[');
      for (int i = 0; i < size; i++) {
        s.append(ids[i]);
        if (i + 1 < size) {
          s.append(',');
        }
      }
      s.append(']');
    }

    Set<Character> keys = n.children.keySet();
    int size = keys.size();
    Character[] children = new Character[size];
    children = keys.toArray(children);

    if (n.ids != null && size > 0) {
      s.append(',');
    }

    for (int i = 0; i < size; i++) {
      char c = children[i];
      Node node = n.children.get(c);
      // if (c >= 'a' && c <= 'z') {
      // s.append(c);
      // }
      // else {

      if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
        s.append(c);
      } else {
        s.append('"');
        if (c == '"') {
          s.append("\\\"");
        } else if (c == '\\') {
          s.append("\\\\");
        } else {
          s.append(c);
        }
        s.append('"');
      }

      s.append(':');
      json(node, s);
      if (i + 1 < size) {
        s.append(',');
      }
    }

    s.append('}');
  }
}
