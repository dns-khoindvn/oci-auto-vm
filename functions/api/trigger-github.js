export async function onRequestPost(context) {
  const { env } = context;

  try {
    // Lấy token GitHub từ biến môi trường của Cloudflare Pages
    const githubToken = env.GITHUB_PAT;
    const repoOwner = env.GITHUB_OWNER; // Tên user GitHub của bạn
    const repoName = env.GITHUB_REPO; // Tên repo chứa code này

    if (!githubToken || !repoOwner || !repoName) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Chưa cấu hình GITHUB_PAT, GITHUB_OWNER hoặc GITHUB_REPO trong Cloudflare Pages.' 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Gọi API của GitHub để kích hoạt workflow (workflow_dispatch)
    const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/auto-renew-ssl.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'Cloudflare-Pages-Worker'
      },
      body: JSON.stringify({
        ref: 'main' // Nhánh chạy workflow
      })
    });

    if (response.ok) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Đã kích hoạt GitHub Actions thành công!' 
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({ 
        success: false, 
        message: `Lỗi từ GitHub: ${response.status} - ${errorText}` 
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: 'Lỗi: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}