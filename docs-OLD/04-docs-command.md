# Cleaning Docker
    -> docker system prune -a --volumes
    
# Build apa???? 
    docker-compose build --no-cache siakad-app
    docker-compose up -d --force-recreate siakad-app

# Tambahin image naming (biar gak build terus)
dosen:
  build: ./php/8.2
  image: app-php:8.2

# Composer auto load ?? ini apa yas 
docker exec -it dosen-app composer install


di dockerfile 
pake ini timezone ya
# Set timezone
ENV TZ=Asia/Jakarta