package com.skrul.greasefire;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Node {

	public Map<Character,Node> children;
	public List<Integer> ids;
	public int pos = -1;

	public Node() {
		children = new HashMap<Character,Node>();
	}
	
	public Node addChild(char c) {
		Node child = children.get(c);
		if (child == null) {
			child = new Node();
			children.put(c, child);
		}
		return child;
	}

	public void addId(int id) {
		if (ids == null) {
			ids = new ArrayList<Integer>();
		}
		ids.add(id);
	}
}
