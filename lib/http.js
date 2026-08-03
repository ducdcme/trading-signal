export async function readJsonResponse(response, exchange) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${exchange} API không trả dữ liệu JSON; có thể đang bị giới hạn theo mạng hoặc khu vực`);
  }
  if (!response.ok) {
    const detail = payload.msg || payload.retMsg || payload.message || response.statusText;
    throw new Error(`${response.status} ${detail}`.trim());
  }
  return payload;
}

