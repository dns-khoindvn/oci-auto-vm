export async function onRequestPost(context) {
  const { request } = context;
  
  const text = await request.text();
  
  // Trích xuất UDID từ XML
  const udidMatch = text.match(/<key>UDID<\/key>\s*<string>(.*?)<\/string>/);
  const udid = udidMatch ? udidMatch[1] : 'Unknown';

  // Chuyển hướng người dùng về trang web của bạn kèm theo UDID
  // Lưu ý: Apple yêu cầu trả về HTTP 301 để chuyển hướng sau khi nhận profile
  const redirectUrl = `https://muacert.com/success?udid=${udid}`;
  
  return Response.redirect(redirectUrl, 301);
}