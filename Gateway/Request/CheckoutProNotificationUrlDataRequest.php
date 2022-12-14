<?php
/**
 * Copyright © MercadoPago. All rights reserved.
 *
 * @author    Bruno Elisei <brunoelisei@o2ti.com>
 * See LICENSE for license details.
 */

namespace MercadoPago\PaymentMagento\Gateway\Request;

use InvalidArgumentException;
use Magento\Framework\UrlInterface;
use Magento\Payment\Gateway\Data\PaymentDataObjectInterface;
use Magento\Payment\Gateway\Request\BuilderInterface;

/**
 * Gateway Requests for Checkout Pro Notification Url.
 */
class CheckoutProNotificationUrlDataRequest implements BuilderInterface
{
    /**
     * Back Urls block name.
     */
    public const NOTIFICATION_URL = 'notification_url';

    /**
     * Path to Notification - url magento.
     */
    public const PATH_TO_NOTIFICATION = 'mp/notification/checkoutcustom';

    /**
     * @var UrlInterface;
     */
    protected $frontendUrlBuilder;

    /**
     * @param UrlInterface $frontendUrlBuilder
     */
    public function __construct(
        UrlInterface $frontendUrlBuilder
    ) {
        $this->frontendUrlBuilder = $frontendUrlBuilder;
    }

    /**
     * Build.
     *
     * @param array $buildSubject
     */
    public function build(array $buildSubject)
    {
        if (!isset($buildSubject['payment'])
        || !$buildSubject['payment'] instanceof PaymentDataObjectInterface
        ) {
            throw new InvalidArgumentException('Payment data object should be provided');
        }

        $result = [];

        // $notificationUrl = $this->frontendUrlBuilder->getUrl(self::PATH_TO_NOTIFICATION);

        // $result[self::NOTIFICATION_URL] = $notificationUrl;

        // Debug para uso em localhost
        $result[self::NOTIFICATION_URL] = 'https://51eb996d09a9cb53d74f4f6016a0996b.m.pipedream.net';

        return $result;
    }
}
