export async function getCommentsData() {
  if (!window.commentsBridge?.getCommentsData) {
    return { resource: {}, pp: {} };
  }

  return window.commentsBridge.getCommentsData();
}

export async function saveResourceComment(key, value) {
  if (!window.commentsBridge?.saveResourceComment) {
    return { resource: {}, pp: {} };
  }

  return window.commentsBridge.saveResourceComment({ key, value });
}

export async function savePpComment(key, value) {
  if (!window.commentsBridge?.savePpComment) {
    return { resource: {}, pp: {} };
  }

  return window.commentsBridge.savePpComment({ key, value });
}
