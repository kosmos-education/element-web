#!/usr/bin/env groovy
@Library('kosmos_pipeline') _

def localBuildClosure = { defaultStep, args ->
    // Comme en plus de faire l'image docker, on va utiliser yarn publish, on utilise les credentials de Nexus
    withCredentials([usernamePassword(credentialsId: 'JENKINS_NEXUS_AUTH', usernameVariable: 'NEXUS_USER', passwordVariable: 'NEXUS_PASS')]) {
        sh "docker build --secret id=NEXUS_USER --secret id=NEXUS_PASS ."
        defaultStep()
    }
}

// Utilisation du pipeline générique de kosmos-pipeline
pipelineDocker(
        IMAGE_NAME: 'skolengo/element-web',
        DOCKER_LABEL: 'docker',
        NOTIF_CHANNEL: 'kde-jenkins',
        DISABLE_DEPLOYMENT_STEP: true,
        CLUSTER_NAME: 'skoen',
        DOCKER_OPTIONS: '--build-arg NPM_TOKEN=${NPM_TOKEN}',

        PRE_BUILD_CLOSURE: {
            echo "Préparation du repo Git (fetch tags + unshallow si nécessaire)"

            sh '''
            # Vérifie si le dépôt est shallow
            if git rev-parse --is-shallow-repository 2>/dev/null | grep -q "true"; then
                echo "Dépôt shallow détecté → unshallow"
                git fetch --unshallow
            else
                echo "Dépôt déjà complet → pas d'unshallow"
            fi

            # Récupération des tags
            git fetch --tags

            echo "Tags disponibles :"
            git tag -l
        '''
        },
        BUILD_STEP_CLOSURE: localBuildClosure
)
