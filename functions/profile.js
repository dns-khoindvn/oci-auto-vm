import forge from 'node-forge';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Lấy chứng chỉ và private key từ Cloudflare KV (ZeroSSL)
    const certPem = await env.SSL_CERTS.get('cert.pem');
    const keyPem = await env.SSL_CERTS.get('key.pem');
    const caPem = await env.SSL_CERTS.get('ca.pem');

    if (!certPem || !keyPem) {
      return new Response('Chưa cấu hình chứng chỉ SSL trong KV. Vui lòng truy cập /renew-ssl-now để tạo.', { status: 500 });
    }

    // Nội dung file mobileconfig gốc (chưa ký)
    const unsignedProfile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<dict>
		<key>DeviceAttributes</key>
		<array>
			<string>UDID</string>
			<string>DEVICE_NAME</string>
			<string>VERSION</string>
			<string>PRODUCT</string>
			<string>MAC_ADDRESS_EN0</string>
			<string>IMEI</string>
			<string>ICCID</string>
		</array>
		<key>URL</key>
		<string>https://muacert.com/uuid/endpoint</string>
	</dict>
	<key>PayloadDescription</key>
	<string>Bấm vào cài đặt để lấy UDID của máy bạn 
- muacert.com
Website Bán Chứng Chỉ Chính Thức
- Vũ Văn Khơi
- khoindvn</string>
	<key>PayloadDisplayName</key>
	<string>Lấy UDID Thiết Bị</string>
	<key>PayloadIdentifier</key>
	<string>muacert.com</string>
	<key>PayloadOrganization</key>
	<string>khơindvn</string>
	<key>PayloadType</key>
	<string>Profile Service</string>
	<key>PayloadUUID</key>
	<string>01703BFB-D863-4897-8A09-DD1E9A58D266</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
</dict>
</plist>`;

    // Ký file bằng node-forge
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(unsignedProfile, 'utf8');
    
    const cert = forge.pki.certificateFromPem(certPem);
    const privateKey = forge.pki.privateKeyFromPem(keyPem);
    
    p7.addCertificate(cert);
    if (caPem) {
        const caCert = forge.pki.certificateFromPem(caPem);
        p7.addCertificate(caCert);
    }
    
    p7.addSigner({
      key: privateKey,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data
        },
        {
          type: forge.pki.oids.messageDigest
        },
        {
          type: forge.pki.oids.signingTime
        }
      ]
    });

    p7.sign();
    const signedDer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    
    // Chuyển đổi sang ArrayBuffer để trả về
    const buffer = new ArrayBuffer(signedDer.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < signedDer.length; i++) {
        view[i] = signedDer.charCodeAt(i);
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/x-apple-aspen-config',
        'Content-Disposition': 'attachment; filename="udid.mobileconfig"',
      },
    });
  } catch (error) {
    return new Response('Lỗi khi ký profile: ' + error.message, { status: 500 });
  }
}