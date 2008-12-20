<?php
$latest = trim(file_get_contents("indexes/latest"));

if (isset($_SERVER['HTTP_IF_MODIFIED_SINCE'])) {

  $client_time = strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']);
  $latest_time = strtotime(str_replace("T", " ", $latest));

  if ($latest_time <= $client_time) {
    header("HTTP/1.0 304 Not Modified");
    exit;
  }

}

header("Location: http://skrul.com/projects/greasefire/indexes/index_$latest.jar");
exit;
?>
