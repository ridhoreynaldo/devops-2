# jangan buat koneksi terus menerus
# pgbouncer buat increase max connection 

CLOUDFLARE
	- https://dash.cloudflare.com/
		- Add Domain -> Connect Domain
			- Configure AI training & search policies (Recomended All)
			- Import DNS records (Import DNS records automatically - Recommended)
			- Select Free Plan
			- Review Your DNS Record (Continue)
			- COPY NAME SERVER (i updated the name server) [chek whois]
RUMAH WEB
	- Change NAme Server
		- Old
			- nsid1.rumahweb.com
			- nsid2.rumahweb.net
			- nsid3.rumahweb.biz
			- nsid4.rumahweb.org

CLOUDFLARE
    - https://dash.cloudflare.com/
            - Zero Trust
                - Networks
                    - Tunnels & Mesh (Create Tunnel)
                        - Pilih - Cloudflared 
                        - NAME TUNNEL : gateway-tunnel - Save Tunnel
                        - CONFIGURE : COPY TOKEN PINDAHKAN KE .env/gateway/docker-compose.yml
                        - HOSTNAME : Domain(ridhoreynaldo.com)
                        - SERVICE : Type (HTTP), URL (nginx-gateway:80)
						- ADD : WWW.ridhoreynaldo.com to redirect
						- Complete Setup
