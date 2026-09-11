# Setup Hyper-V & WSL2
    - Setup Hyper-V
dism.exe /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    -- Setup Hyper- V
    -- Win+R = optionalfeatures
    -- Enable = Hyper-V, Virtual Machine Platform, Windows Subsystem for Linux
    - Setup WSL2
wsl --set-default-version 2
wsl --install -d Ubuntu-22.04
wsl --update
wsl --status

# WSL Running by Daemon
- Task Scheduler, Run as administrator.					
- klik Create Task... (Jangan memilih Basic Task).						
- General: Beri nama tugas, misalnya: WSL_Boot_Tanpa_Login.							
- pilih opsi Run whether user is logged on or not.			
- Centang pilihan Run with highest privileges.							
- Triggers, klik New..., lalu pada pilihan Begin the task, ubah menjadi At startup.
- Actions, klik New..., lalu atur konfigurasi berikut:							
    - Action: Start a program.							
    - Program/script: Ketik wsl.exe.							
    - Add arguments : Ketik --exec true. (dgunakan -d NamaDistro --exec true).							
- Enable (optional) : Do not store password. The task will only have access to local computer resources.

# Setup Docker Resource
* C:/Users/${user}/.wslconfig
[wsl2]
memory=8GB                  <-- Ambil 50% dari host  
processors=4                <-- Ambil 50% dari host (thread / logical processors)
swap=4GB                    <-- 50% dari memory                   
localhostForwarding=true    <-- Port dari WSL bisa diakses dari Windows pakai localhost
pageReporting=true          <-- WSL auto balikin RAM saat WSL not use(optional bug error)

# Setup Basic Ubuntu
* Test Ubuntu
whoami
uname -a
free -h
nproc
sudo apt update && sudo apt upgrade -y
sudo apt install build-essential curl git unzip ca-certificates gnupg lsb-release -y

# Install Docker Engine in WSL2
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(lsb_release -cs) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y


# Setup Daemon Docker Engine
    - Enable systemd (kalau nanti butuh service BIAR AUTO TAPI DI WSL NYA AJA )
sudo nano /etc/wsl.conf
[boot]
systemd=true
wsl --shutdown
wsl
sudo systemctl enable docker
sudo systemctl start docker
sudo systemctl status docker
sudo usermod -aG docker ridho
newgrp docker
docker run hello-world

# setup folder & user
sudo groupadd devops
sudo usermod -aG devops ridho
sudo usermod -aG devops www-data (optional if nginx in wsl/host)
newgrp devops
sudo mkdir -p /opt/devops
sudo chown -R ridho:devops /opt/devops
sudo chmod -R 775 /opt/devops (dev)
sudo chmod -R 2775 /opt/devops (prod)


# Delete Zone identifier
find . -name "*:Zone.Identifier" -type f -delete





#????? laravel folder
chmod -R 775 /opt/devops/asrama-putri/storage
chmod -R 775 /opt/devops/asrama-putri/bootstrap/cache