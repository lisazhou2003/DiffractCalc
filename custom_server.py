# custom_server.py
import http.server
import socketserver
import os

PORT = 8000 # You can change this port if 8000 is in use

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    """
    A custom handler to ensure correct MIME types for JavaScript modules.
    """
    def guess_type(self, path):
        # Override the default guess_type to ensure .js files are served as text/javascript
        if path.endswith(".js"):
            return "text/javascript"
        return super().guess_type(path)

    # Optional: Add CORS headers if you ever need to fetch resources from other origins
    # def end_headers(self):
    #     self.send_header('Access-Control-Allow-Origin', '*')
    #     super().end_headers()

if __name__ == "__main__":
    # Change to the directory where your HTML, CSS, and JS files are located
    # This ensures the server serves files from the correct root.
    # Replace 'path/to/your/project' with the actual path.
    # Example: os.chdir('C:/Users/cha_lab/Desktop/YourProjectName')
    # Or, if you run the script from your project directory, you don't need this line.
    # os.chdir(os.path.dirname(os.path.abspath(__file__))) # Uncomment if you want script to change to its own directory

    # If you run this script from the same directory as your index.html,
    # you can comment out the os.chdir line above.

    Handler = CustomHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at port {PORT}")
        print(f"Access your application at: http://localhost:{PORT}")
        httpd.serve_forever()