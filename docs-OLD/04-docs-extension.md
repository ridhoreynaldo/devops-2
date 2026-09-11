# Dockerfile to manage extension for PHP

FROM php:8.2-fpm

# Set Workdir
WORKDIR /var/www/html

# 1. Install dependencies sistem & pustaka ekstensi
RUN apt-get update && apt-get install -y \
    build-essential \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libonig-dev \
    libzip-dev \
    libbz2-dev \
    libgmp-dev \
    libsqlite3-dev \
    libcurl4-openssl-dev \
    gettext \
    zip \
    unzip \
    git \
    curl \
    wget \
    gnupg \
    unixodbc-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Install ODBC Driver 18 untuk SQL Server
RUN curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /usr/share/keyrings/microsoft-prod.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list && \
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql18 && \
    rm -rf /var/lib/apt/lists/*

# 3. Install dan Aktifkan Ekstensi PHP (Padanan dari list Windows Anda)
RUN docker-php-ext-configure gd --with-freetype --with-jpeg && \
    docker-php-ext-install -j$(nproc) \
    gd \
    pdo \
    pdo_mysql \
    mysqli \
    pdo_sqlite \
    bz2 \
    gmp \
    gettext \
    bcmath \
    mbstring \
    exif \
    zip \
    opcache

# 4. Install sqlsrv & pdo_sqlsrv khusus Linux
RUN pecl install sqlsrv-5.12.0 pdo_sqlsrv-5.12.0 && \
    docker-php-ext-enable sqlsrv pdo_sqlsrv

# 5. Install Composer
RUN curl -sS https://getcomposer.org/installer | php \
    && mv composer.phar /usr/bin/composer

# Copy custom config & setting permission
COPY ./custom.ini /usr/local/etc/php/conf.d/custom.ini
COPY ./www.conf /usr/local/etc/php-fpm.d/www.conf
RUN chown -R www-data:www-data /var/www/html

EXPOSE 9000
CMD ["php-fpm"]