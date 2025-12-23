#!/usr/bin/env groovy
@Library('kosmos_pipeline') _

// Utilisation du pipeline générique de kosmos-pipeline
pipelineDocker(
        IMAGE_NAME: 'skolengo/element-web',
        DOCKER_LABEL: 'docker',
        NOTIF_CHANNEL: 'kde-jenkins',
        DISABLE_DEPLOYMENT_STEP: true,
        CLUSTER_NAME: 'skoen',

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
        }

)

