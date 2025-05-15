// Jenkinsfile
def dockerhubCredentialsId = 'dockerhub-credentials' 
def vpsSshCredentialsId = 'vps-ssh-key'          
def dockerImageName = 'maulanaanjari/car-dano-backend' 
def dockerImageTag = 'latest'                   
def vpsHost = '31.220.81.182'                 
def vpsUser = 'maul'                           
def appDirOnVps = '/home/maul/app'            
def dbTestContainerName = "postgres-test-${env.BUILD_NUMBER}" 
def dbTestPassword = 'testpassword'              
def dbTestPort = 5433                          

pipeline {
    agent any

    environment {
        DATABASE_URL_TEST = "postgresql://postgres:${dbTestPassword}@localhost:${dbTestPort}/test_db?schema=public"
        CI = 'true'
    }

    options {
        timestamps()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                script {
                    cleanWs()
                    checkout scm
                    env.DOCKER_IMAGE_TAG = dockerImageTag
                }
            }
        }

        stage('2. Install Dependencies & Generate Prisma') {
            steps {
                script {
                    echo "Installing Node Modules using npm ci..."
                    sh 'npm ci'
                    sh 'npx prisma generate'
                }
            }
        }

        stage('3. Lint & Unit Tests') {
            steps {
                script {
                     echo "Running Linter..."
                     sh 'npm run lint'
                     echo "Running Unit Tests..."
                     sh 'npm run test'
                }
            }
        }

        stage('4. E2E Tests with Test Database') {
            agent {
                 docker {
                     image 'node:20-alpine'
                     args '-v /var/run/docker.sock:/var/run/docker.sock'
                     reuseNode true
                 }
            }
            environment {
                DATABASE_URL = env.DATABASE_URL_TEST
                PORT = '3001'
            }
            steps {
                script {
                    echo "Starting PostgreSQL test container on port ${dbTestPort}..."
                    sh """
                    docker run --name ${dbTestContainerName} \\
                               -e POSTGRES_DB=test_db \\
                               -e POSTGRES_USER=postgres \\
                               -e POSTGRES_PASSWORD=${dbTestPassword} \\
                               -p ${dbTestPort}:5432 \\
                               -d postgres:latest
                    """
                    echo "Waiting for test database to be ready..."
                    sleep 15

                    echo "Applying migrations to test database..."
                    sh 'npx prisma migrate deploy'

                    echo "Running E2E Tests against test database..."
                    sh 'npm run test:e2e'
                }
            }
            post {
                always {
                    script {
                        echo "Stopping and removing PostgreSQL test container..."
                        sh "docker stop ${dbTestContainerName} || true"
                        sh "docker rm ${dbTestContainerName} || true"
                    }
                }
            }
        }

        stage('5. Build Docker Image') {
            steps {
                script {
                    echo "Building Docker image: ${dockerImageName}:${env.DOCKER_IMAGE_TAG}..."
                    def customImage = docker.build("${dockerImageName}:${env.DOCKER_IMAGE_TAG}", ".")
                }
            }
        }

        stage('6. Push Docker Image to Docker Hub') {
            steps {
                script {
                    echo "Pushing Docker image to Docker Hub..."
                    docker.withRegistry('https://registry.hub.docker.com', dockerhubCredentialsId) {
                        sh "docker push ${dockerImageName}:${env.DOCKER_IMAGE_TAG}"
                    }
                    echo "Image pushed successfully."
                }
            }
        }

        stage('7. Deploy to VPS') {
            steps {
                script {
                    echo "Deploying to VPS: ${vpsUser}@${vpsHost}..."
                    sshagent (credentials: [vpsSshCredentialsId]) {
                        sh """
                        ssh -o StrictHostKeyChecking=no ${vpsUser}@${vpsHost} << 'EOF'
                            echo 'Connected to VPS...'
                            cd ${appDirOnVps} || exit 1 # Pindah ke direktori aplikasi, keluar jika gagal
                            echo 'Pulling latest image from Docker Hub...'
                            docker compose -f docker-compose.prod.yml pull app # Tarik image 'app' saja
                            echo 'Restarting application container...'
                            # Gunakan --force-recreate untuk memastikan container baru dibuat dari image baru
                            # Hanya restart service 'app', biarkan 'postgres' tetap jalan
                            docker compose -f docker-compose.prod.yml up -d --force-recreate app
                            echo 'Cleaning up unused docker images...'
                            docker image prune -f # Hapus image lama (optional)
                            echo 'Deployment command executed.'
                        EOF
                        """
                    }
                    echo "Deployment commands sent to VPS."
                }
            }
        }
    }

    post {
        always {
            echo 'Pipeline finished.'
            cleanWs()
        }
        success {
            echo 'Pipeline succeeded!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}