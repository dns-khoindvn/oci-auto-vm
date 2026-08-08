import forge from 'node-forge';

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Lấy chứng chỉ và private key từ Cloudflare KV (ZeroSSL)
    const certPem = await env.SSL_CERTS.get('cert.pem');
    const keyPem = await env.SSL_CERTS.get('key.pem');
    const caPem = await env.SSL_CERTS.get('ca.pem');

    if (!certPem || !keyPem) {
      return new Response('Chưa cấu hình chứng chỉ SSL trong KV. Vui lòng gia hạn SSL trước.', { status: 500 });
    }

    // Nội dung file khoindvn_unsigned.mobileconfig
    const unsignedProfile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>DNSSettings</key>
			<dict>
				<key>DNSProtocol</key>
				<string>HTTPS</string>
				<key>ServerAddresses</key>
				<array>
					<string>1.1.1.1</string>
					<string>1.0.0.1</string>
					<string>2606:4700:4700::1111</string>
					<string>2606:4700:4700::1001</string>
				</array>
				<key>ServerURL</key>
				<string>https://qhlfy08c6u.cloudflare-gateway.com/dns-query</string>
				</dict>
			<key>OnDemandRules</key>
			<array>
				<dict>
					<key>Action</key>
					<string>Connect</string>
					<key>InterfaceTypeMatch</key>
					<string>WiFi</string>
				</dict>
				<dict>
					<key>Action</key>
					<string>Connect</string>
					<key>InterfaceTypeMatch</key>
					<string>Cellular</string>
				</dict>
			</array>
			<key>PayloadDescription</key>
			<string>Configures device to use khơindvn Encrypted DNS over HTTPS</string>
			<key>PayloadDisplayName</key>
			<string>Anti Revoke</string>
			<key>PayloadIdentifier</key>
			<string>com.apple.dnsSettings.managed.bf38e538-86b3-4ec9-8ab2-2d51bb6bb3a7</string>
			<key>PayloadOrganization</key>
			<string>khơindvn</string>
			<key>PayloadType</key>
			<string>com.apple.dnsSettings.managed</string>
			<key>PayloadUUID</key>
		<string>8F901D47-A361-4E74-89E3-0AA50D7AA093</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
		<dict>
			<key>FullScreen</key>
			<true/>
			<key>Icon</key>
			<data>
			iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAB1tfliAAAADUlIRFIAAAB4AAAA
			eAgGAAAAOWQ20gAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABxpRE9UAAAAAgAAAAAAAA
			A8AAAAKAAAADwAAAA8AAAJG2CUYCcAAAjnSURBVOxcbW8cVxXev7L+wLolCusEVeal
			ohIUIrEWlfqBfii0QBGhSpVGBYqC1KhCgiAhGqmWkqqsSxVBK4ECu7VKKkqIVOIyu469
			L+M03nUcmhc72Ulsr2eDHW98Hj7cOzP3zs7szKydrO29Vzq6d14ez+599tw55zwzjhER
			iAgA7N5q4n7xvDDHvY6593UL63Vsp2Jjfn+gnQVN9EawQV9qM7DtJquTudjK2I4Ibjdx
			UQiOcux+Yneyxbp58c32/k4I3gjx2wG7ZQj2WnKiLNdRCVce3EO2k71YEaw8WJkiWJki
			WJkiWNn9IBgRmrtUGfbcKLhOzldY/xaLAmz3x4Iu5Hfcq8Yd9pyNYHulxfyEhKgk+gkR
			nWL9VoAw1wnCthNP2hVRtiM21kkJsVOSgr5EGGwYwoOwYSYrTGVsO2A7JjhsyTCsFOn1
			odupJxvBBk1WlDr2VsfGNrtM1o4IpSZtwzQpjAdvdYI3IlRsdWwMqu3sKFpNgSJYNUWw
			atui0KFMRdHKFMHKFMHb1FbWCWN1wu+uEp69SHi+QvjnQo/KhTuhNYlQagBvzAHfuwgk
			80B/rtXS81tXPgwtFwYJDWFku9VLf8fyh4ew9P4PI1n9Hy9itZqVrlFYmMbPC6/jB/95
			NZL9OPcrvD37Hu6ur3l8RmB2BfjTTeCFKjA4AfRrHqS69n0uDyw0t3CaFEYhCiKxnX5M
			RGI5Pypv9T5hY/W51m1Y6i/a+rF97p/8+m2s+j80/7e3wJ7/
			</data>
			<key>IsRemovable</key>
			<true/>
			<key>Label</key>
			<string>khơindvn</string>
			<key>PayloadDescription</key>
			<string>Khơindvn Website</string>
			<key>PayloadDisplayName</key>
			<string>khơindvn</string>
			<key>PayloadIdentifier</key>
			<string>com.apple.webClip.managed.5D7E842D-0B86-4559-99E8-316279E45759</string>
			<key>PayloadOrganization</key>
			<string>khơindvn</string>
			<key>PayloadType</key>
			<string>com.apple.webClip.managed</string>
			<key>PayloadUUID</key>
			<string>5D7E842D-0B86-4559-99E8-316279E45759</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>URL</key>
			<string>https://khoindvn.io.vn</string>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>Cấu hình DNS Anti Revoke &amp; Webclip khơindvn</string>
	<key>PayloadDisplayName</key>
	<string>khơindvn Profile</string>
	<key>PayloadIdentifier</key>
	<string>com.apple.dnsSettings.managed.khoindvn</string>
	<key>PayloadOrganization</key>
	<string>khơindvn</string>
	<key>PayloadScope</key>
	<string>System</string>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>C0E1B057-0B0B-4813-8E56-2C2269E7B343</string>
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
        'Content-Disposition': 'attachment; filename="khoindvn.mobileconfig"',
      },
    });
  } catch (error) {
    return new Response('Lỗi khi ký profile khoindvn: ' + error.message, { status: 500 });
  }
}
