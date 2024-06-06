/*
name: cloudflare安全代理
author: eray
version: v1.0
blog: blog.eray.cc
email: admin@eray.cc

desp: 本项目可以给cf代理设置一个密码，使代理更安全，调用更方便

config set:
需要替换：

密码验证路径（可选）：
/your-pwd-verify-path

越权Api代理前缀路径[用于代理openai等api]
（可以直接注释删除，不使用）:
/your-safe-api-prefix/

访问密码（推荐设置复杂一些）：
your-access-pwd

*/

addEventListener('fetch', event => {
	event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {

	const url = new URL(request.url);

	// Check if some api direct browse, the path should be hard to guess, u can comment it out if you don't need it
	if (url.pathname.includes('/your-safe-api-prefix/')) {
		return handleApiRequest(request);
	}

	// Check if the request is for password verification
	if (url.pathname === '/your-pwd-verify-path' && request.method === 'POST') {
		const password = await request.text();
		if (verifyPassword(password)) {
			return new Response('success', {
				headers: {
					'Content-Type': 'text/plain'
				},
			});
		} else {
			return new Response('failure', {
				headers: {
					'Content-Type': 'text/plain'
				},
			});
		}
	}

	// Check if password cookie exists
	const savedPassword = request.headers.get('Cookie');

	if (!savedPassword) {
		return createPasswordPage();
	}

	//if exists cookie but is not pwd
	if (savedPassword) {
		const parsedCookies = parseCookies(savedPassword);
		const passwordValue = parsedCookies['password'];
		if (!verifyPassword(passwordValue)) {
			return createPasswordPage();
		}
	}

	// Check if accessing path
	if (url.pathname === '/' || url.pathname === '/proxy/' || url.pathname === '/proxy') {  
		return createLandingPage();
	}

	// If password cookie exists and accessing other paths, handle proxying
	return handleProxyRequest(request);
}

async function handleProxyRequest(request) {
	const url = new URL(request.url);

	// Use fixUrl function to ensure valid URL protocol
	const actualUrlStr = fixUrl(url.pathname.replace("/proxy/", "")) + url.search + url.hash;
	const actualUrl = new URL(actualUrlStr);

  // Copy headers from the original request, but remove any CF headers  
  let newHeaders = new Headers();
  for (let pair of request.headers.entries()) {
    if (!pair[0].startsWith('cf-')) {
      newHeaders.append(pair[0], pair[1]);
    }
  }
	const modifiedRequest = new Request(actualUrl, {
		headers: newHeaders,
		method: request.method,
		body: request.body,
		redirect: 'manual'
	});

	const response = await fetch(modifiedRequest);
  let modifiedResponse;
  let body = response.body;

  // Handle redirects
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = new URL(response.headers.get('location'));
    const modifiedLocation = "/proxy/" + location.toString();
    modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText
    });
    modifiedResponse.headers.set('Location', modifiedLocation);
  } else {
    if (response.headers.get("Content-Type") && response.headers.get("Content-Type").includes("text/html")) {
      const originalText = await response.text();
      const regex = new RegExp('((href|src|action)=["\'])/(?!/)', 'g');
      let modifiedText = originalText.replace(regex, `$1${url.protocol}//${url.host}/proxy/${new URL(actualUrlStr).origin + "/"}`);
      const regex2 = new RegExp('((href|src|action)=["\'])https\://github.com', 'g');
      modifiedText = originalText.replace(regex2, `$1${url.protocol}//${url.host}/proxy/https://github.com`);
      //我费了，谁会谁改吧，下面加上后加不出css，不加的话完整路径，search的只有？的也不行
      //const regex2 = new RegExp('((href|src|action)=["\'])http', 'g');
      //modifiedText = originalText.replace(regex2, `$1${url.protocol}//${url.host}/proxy/http`);
      body = modifiedText;
    }

    modifiedResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }

	// Add headers for CORS
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', '*');
	return modifiedResponse;
}

async function handleApiRequest(request) {
	const url = new URL(request.url);
	// Use fixUrl function to ensure valid URL protocol
	const actualUrlStr = fixUrl(url.pathname.replace("/your-safe-api-prefix/", "")) + url.search + url.hash;
	const actualUrl = new URL(actualUrlStr);

	const modifiedRequest = new Request(actualUrl, {
		headers: request.headers,
		method: request.method,
		body: request.body,
		redirect: 'follow'
	});

	const response = await fetch(modifiedRequest);
	const modifiedResponse = new Response(response.body, response);

	// Add headers for CORS
	modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');

	return modifiedResponse;
}

function fixUrl(url) {
	if (url.includes("github")) {//this is for github    
    if (url.includes("://")) {
      return url;
    } else if (url.includes(':/')) {
      return url.replace(':/', '://');
    } else {
      return "http://" + url;
    }
  }
  else
      return "https://github.com"+url;
}

// parse cookie
function parseCookies(cookieString) {
	return cookieString.split(';')
		.reduce((cookies, cookie) => {
			const [name, value] = cookie.trim()
				.split('=');
			cookies[name] = value;
			return cookies;
		}, {});
}

// Create the password verification page
function createPasswordPage() {
	const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>密码验证</title>
    </head>
    <style>
    body {
    background-color: #fbfbfb;
    font-family: Arial, sans-serif;
  }

  h1 {
    text-align: center;
    color: #444;
  }

  .container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
  }

  form {
    background-color: white;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
    padding: 2rem;
    border-radius: 8px;
  }

  input {
    display: block;
    width: 100%;
    font-size: 18px;
    padding: 15px;
    border: solid 1px #ccc;
    border-radius: 4px;
    margin: 1rem 0;
  }

  button {
    padding: 15px;
    background-color: #0288d1;
    color: white;
    font-size: 18px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    width: 100%;
  }

  button:hover {
    background-color: #039BE5;
  }
    </style>
    <body>
      <h1>密码验证</h1>
      <form id="password-form">
        <input type="password" id="password" name="password" placeholder="请输入访问密码" required />
        <button type="submit">验证密码</button>
      </form>
      <script>
        const form = document.getElementById('password-form');
        form.addEventListener('submit', event => {
          event.preventDefault();
          const input = document.getElementById('password');
          const password = input.value;

          // Send password for verification
          fetch('/your-pwd-verify-path', { method: 'POST', body: password })
            .then(response => response.text())
            .then(result => {
              if (result === 'success') {
                // Password verification successful, set cookie, and redirect to the landing page
                document.cookie = 'password=' + password + '; expires=' + new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
                location.href = '/proxy/';
              } else {
                alert('密码验证失败！');
              }
            });
        });
      </script>
    </body>
    </html>
  `;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}

// Create the landing page
function createLandingPage() {
	const html = `
  <!DOCTYPE html>
  <body>
    <script>
      const proxyUrl = '/proxy/github.com';
      location.href = proxyUrl;
    </script>
  </body>
  </html>
  `;

	return new Response(html, {
		headers: {
			'Content-Type': 'text/html'
		}
	});
}

// Verify the password function
function verifyPassword(savedPassword) {
	// Replace this logic with your actual password verification
	return savedPassword === "your-access-pwd";
}
